import { google } from 'googleapis';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { atualizarDriveUrl, listarCriativos } from '../db/dal.js';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

import http from 'http';
import url from 'url';

// ─── OAuth2 Setup ───
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

function getAuthClient() {
    const oauth2 = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        REDIRECT_URI
    );

    if (process.env.GOOGLE_REFRESH_TOKEN) {
        oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    }

    return oauth2;
}

function getDrive() {
    return google.drive({ version: 'v3', auth: getAuthClient() });
}

// ─── Auth Flow (first time only) ───
export function getAuthUrl() {
    const auth = getAuthClient();
    return auth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // Force consent prompt to ensure refresh token is returned
        scope: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive',
        ],
    });
}

/**
 * Spins up a local server to catch the OAuth redirect,
 * exchanges the code for tokens, and returns the refresh token.
 */
export function runAuthServer() {
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                if (req.url.startsWith('/oauth2callback')) {
                    const qs = new url.URL(req.url, 'http://localhost:3000').searchParams;
                    const code = qs.get('code');

                    if (code) {
                        res.end('<h1>Autenticação concluída com sucesso!</h1><p>Pode fechar esta aba e voltar ao terminal.</p>');
                        server.destroy();

                        const auth = getAuthClient();
                        const { tokens } = await auth.getToken(code);
                        auth.setCredentials(tokens);

                        if (tokens.refresh_token) {
                            logger.info(`[Drive] ✅ Refresh token obtained!`, { phase: 'DRIVE_AUTH' });
                            resolve(tokens.refresh_token);
                        } else {
                            reject(new Error('Nenhum refresh token retornado. Talvez já tenha sido autorizado antes. Tente remover o app nas configurações de conta Google e tente novamente.'));
                        }
                    } else {
                        res.end('<h1>Falha</h1><p>Nenhum código encontrado.</p>');
                        reject(new Error('No code found in redirect URL'));
                    }
                }
            } catch (err) {
                reject(err);
            }
        });

        // Track sockets so we can force close the server
        const sockets = new Set();
        server.on('connection', (socket) => {
            sockets.add(socket);
            socket.once('close', () => sockets.delete(socket));
        });
        server.destroy = () => {
            for (const socket of sockets) socket.destroy();
            server.close();
        };

        server.listen(3000, () => {
            const authUrl = getAuthUrl();
            logger.info(`\n🔗 [GOOGLE DRIVE AUTH] Acesse o link abaixo no seu navegador:\n`);
            logger.info(`${authUrl}\n`);
            logger.info(`⏳ Aguardando você fazer login e autorizar... (O servidor local está escutando na porta 3000)`);
        });
    });
}

// ─── Upload Methods ───

/**
 * Upload a creative video to Google Drive.
 * @param {string} localPath - Path to local file
 * @param {string} nomeArquivo - File name for Drive
 * @param {string} [parentFolderId] - Parent folder ID (defaults to GOOGLE_DRIVE_FOLDER_ID)
 * @returns {{ fileId, webViewLink, webContentLink }}
 */
export async function uploadCreativo(localPath, nomeArquivo, parentFolderId = null) {
    const drive = getDrive();
    const folderId = parentFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID not set');

    // [ROUTE SENTINEL GUARDIAN] Check if folder exists before blindly uploading
    try {
        await drive.files.get({ fileId: folderId, fields: 'id' });
    } catch (e) {
        if (e.status === 404) {
            throw new Error(`[ASAVIA ROUTE SENTINEL] P0: GOOGLE_DRIVE_FOLDER_ID '${folderId}' não existe no Drive destino ou a Service Account carece de permissões. Falha de Contract interceptada.`);
        }
        throw new Error(`[Drive Contract] Erro ao validar a pasta pai: ${e.message}`);
    }

    logger.info(`[Drive] Uploading: ${nomeArquivo} to folder ${folderId}`, { phase: 'DRIVE_UPLOAD' });

    const fileSize = (await fs.stat(localPath)).size;

    const response = await drive.files.create({
        requestBody: {
            name: nomeArquivo,
            parents: [folderId],
            mimeType: 'video/mp4',
        },
        media: {
            mimeType: 'video/mp4',
            body: fs.createReadStream(localPath),
        },
        fields: 'id, name, webViewLink, webContentLink, size',
    });

    const fileId = response.data.id;

    // Make file viewable by anyone with link
    await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
    });

    // Get shareable link
    const fileData = await drive.files.get({
        fileId,
        fields: 'webViewLink, webContentLink',
    });

    const webViewLink = fileData.data.webViewLink;
    logger.info(`[Drive] ✅ Uploaded: ${nomeArquivo} (${(fileSize / 1024 / 1024).toFixed(1)}MB)`, { phase: 'DRIVE_UPLOAD_OK' });
    logger.info(`[Drive] URL: ${webViewLink}`, { phase: 'DRIVE_UPLOAD_OK' });

    return { fileId, webViewLink, webContentLink: fileData.data.webContentLink };
}

/**
 * Upload from Supabase Storage URL (download first, then upload to Drive).
 */
export async function uploadFromUrl(supabaseUrl, nomeArquivo, parentFolderId = null) {
    const os = await import('os');
    const tmpPath = path.join(os.default.tmpdir(), `adsgen_drive_${Date.now()}_${nomeArquivo}`);

    try {
        const response = await fetch(supabaseUrl);
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(tmpPath, buffer);

        const result = await uploadCreativo(tmpPath, nomeArquivo, parentFolderId);
        return result;
    } finally {
        await fs.remove(tmpPath).catch(() => { });
    }
}

/**
 * Create a subfolder in Google Drive.
 * @param {string} parentId - Parent folder ID
 * @param {string} nome - Folder name
 * @returns {string} Created folder ID
 */
export async function criarSubpasta(parentId, nome) {
    const drive = getDrive();

    logger.info(`[Drive] Creating folder: ${nome}`, { phase: 'DRIVE_FOLDER' });

    // Check if folder already exists
    const existing = await drive.files.list({
        q: `name='${nome}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
    });

    if (existing.data.files?.length > 0) {
        logger.info(`[Drive] Folder exists: ${nome} (${existing.data.files[0].id})`, { phase: 'DRIVE_FOLDER' });
        return existing.data.files[0].id;
    }

    const response = await drive.files.create({
        requestBody: {
            name: nome,
            parents: [parentId],
            mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
    });

    logger.info(`[Drive] ✅ Folder created: ${nome} (${response.data.id})`, { phase: 'DRIVE_FOLDER_OK' });
    return response.data.id;
}

/**
 * Get shareable URL for a file.
 */
export async function getShareableUrl(fileId) {
    const drive = getDrive();
    const file = await drive.files.get({ fileId, fields: 'webViewLink' });
    return file.data.webViewLink;
}

/**
 * Upload all ready creatives for a briefing to Google Drive.
 * Creates subfolder: {produto}/{YYYY-MM-DD}/
 * @param {string} briefingId
 * @param {Object} opts - { produto }
 * @returns {Array<{ hookNum, driveUrl, fileId }>}
 */
export async function uploadTodos(briefingId, opts = {}) {
    const { data: briefing } = await supabase
        .from('briefings').select('projeto_id').eq('id', briefingId).single();

    const { data: projeto } = await supabase
        .from('projetos').select('nome').eq('id', briefing?.projeto_id).single();

    const produto = opts.produto || projeto?.nome || 'criativo';
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootFolderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID not set in .env');

    // Create subfolder: {produto}/{date}
    const produtoFolderId = await criarSubpasta(rootFolderId, produto);
    const dateFolderId = await criarSubpasta(produtoFolderId, new Date().toISOString().slice(0, 10));

    // Get all ready creatives
    const { data: criativos, error: errCriativos } = await supabase
        .from('criativos_finais')
        .select('*')
        .eq('briefing_id', briefingId)
        .eq('status', 'pronto');

    if (errCriativos) {
        logger.error(`[Drive] Failed to query creatives: ${errCriativos.message}`);
        throw new Error(`Database failure looking for creatives: ${errCriativos.message}`);
    }

    if (!criativos || criativos.length === 0) {
        throw new Error(`Pipeline concluiu mas 0 criativos finais encontrados em status 'pronto' para upload`);
    }
    logger.warn(`[Drive] No ready creatives for ${briefingId}`, { phase: 'DRIVE_WARN' });
    return [];
}

const results = [];
for (const criativo of criativos) {
    try {
        const { fileId, webViewLink } = await uploadFromUrl(
            criativo.arquivo_path,
            criativo.nome_arquivo,
            dateFolderId
        );

        // Update DB with Drive URL
        await atualizarDriveUrl(criativo.id, webViewLink, fileId);

        results.push({
            hookNum: criativo.hook_numero,
            driveUrl: webViewLink,
            fileId,
            fileName: criativo.nome_arquivo,
        });
    } catch (error) {
        logger.error(`[Drive] Failed: ${criativo.nome_arquivo} — ${error.message}`, { phase: 'DRIVE_ERR' });
    }
}

logger.info(`[Drive] ✅ Uploaded ${results.length}/${criativos.length} creatives`, { phase: 'DRIVE_DONE' });
return results;
}

export default { uploadCreativo, uploadFromUrl, criarSubpasta, getShareableUrl, uploadTodos, getAuthUrl, runAuthServer };
