import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = 'assets';

/**
 * Upload avatar image buffer to Supabase Storage
 * @param {Buffer} buffer - Image buffer (PNG/JPG)
 * @param {string} fileName - e.g. 'avatar_principal_abc123.png'
 * @returns {{ url: string, path: string }}
 */
export async function uploadAvatar(buffer, fileName) {
    const storagePath = `avatares/${fileName}`;
    logger.info(`Uploading avatar to Storage: ${storagePath}`, { phase: 'STORAGE_UPLOAD' });

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
            contentType: 'image/png',
            upsert: true
        });

    if (error) {
        logger.error(`Storage upload failed: ${error.message}`, { phase: 'STORAGE_ERROR' });
        throw error;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    logger.info(`Avatar uploaded: ${urlData.publicUrl}`, { phase: 'STORAGE_OK' });
    return { url: urlData.publicUrl, path: storagePath };
}

/**
 * Upload video to Supabase Storage (accepts buffer or file path)
 * @param {Buffer|string} input - Buffer or local file path
 * @param {string} fileName - e.g. 'hook_1_v1.mp4'
 * @returns {{ url: string, path: string }}
 */
export async function uploadVideo(input, fileName) {
    const storagePath = `videos/${fileName}`;
    logger.info(`Uploading video to Storage: ${storagePath}`, { phase: 'STORAGE_UPLOAD' });

    const fileBuffer = Buffer.isBuffer(input) ? input : await fs.readFile(input);
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
            contentType: 'video/mp4',
            upsert: true
        });

    if (error) {
        logger.error(`Video upload failed: ${error.message}`, { phase: 'STORAGE_ERROR' });
        throw error;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    logger.info(`Video uploaded: ${urlData.publicUrl}`, { phase: 'STORAGE_OK' });
    return { url: urlData.publicUrl, path: storagePath };
}

/**
 * Upload audio to Supabase Storage (accepts buffer or file path)
 * @param {Buffer|string} input - Buffer or local file path
 * @param {string} fileName - e.g. 'hook_1.mp3'
 * @returns {{ url: string, path: string }}
 */
export async function uploadAudio(input, fileName) {
    const storagePath = `audios/${fileName}`;
    logger.info(`Uploading audio to Storage: ${storagePath}`, { phase: 'STORAGE_UPLOAD' });

    const fileBuffer = Buffer.isBuffer(input) ? input : await fs.readFile(input);
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
            contentType: 'audio/mpeg',
            upsert: true
        });

    if (error) {
        logger.error(`Audio upload failed: ${error.message}`, { phase: 'STORAGE_ERROR' });
        throw error;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    logger.info(`Audio uploaded: ${urlData.publicUrl}`, { phase: 'STORAGE_OK' });
    return { url: urlData.publicUrl, path: storagePath };
}

/**
 * Upload any buffer to Supabase Storage
 * @param {Buffer} buffer - File buffer
 * @param {string} storagePath - Full path in bucket, e.g. 'audios/briefing123/hook_1.mp3'
 * @param {string} contentType - MIME type
 * @returns {{ url: string, path: string }}
 */
export async function uploadBuffer(buffer, storagePath, contentType = 'application/octet-stream') {
    logger.info(`Uploading to Storage: ${storagePath}`, { phase: 'STORAGE_UPLOAD' });

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType, upsert: true });

    if (error) {
        logger.error(`Upload failed: ${error.message}`, { phase: 'STORAGE_ERROR' });
        throw error;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    logger.info(`Uploaded: ${urlData.publicUrl}`, { phase: 'STORAGE_OK' });
    return { url: urlData.publicUrl, path: storagePath };
}

/**
 * Get a temp file path (for FFmpeg processing that needs file I/O)
 * Auto-cleans after callback completes.
 * @param {string} ext - File extension (e.g. '.mp3')
 * @param {Function} callback - async (tmpPath) => result
 * @returns {*} callback result
 */
export async function withTempFile(ext, callback) {
    const tmpPath = path.join(os.tmpdir(), `adsgen_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    try {
        return await callback(tmpPath);
    } finally {
        await fs.remove(tmpPath).catch(() => { });
    }
}

export default { uploadAvatar, uploadVideo, uploadAudio, uploadBuffer, withTempFile };
