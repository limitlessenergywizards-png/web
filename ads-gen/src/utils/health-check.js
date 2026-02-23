import dotenv from 'dotenv';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import { supabaseAdmin } from '../db/supabase.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(msg, color = 'reset') {
    console.log(`${colors[color] || ''}${msg}${colors.reset}`);
}

async function testPing(name, testFn) {
    try {
        const start = Date.now();
        await testFn();
        const duration = Date.now() - start;
        log(`  [OK] ${name} (⏳ ${duration}ms)`, 'green');
        return true;
    } catch (err) {
        log(`  [FALHA] ${name}: ${err.message}`, 'red');
        return false;
    }
}

export async function runHealthCheck() {
    log('\n======================================================', 'cyan');
    log('               ADS-GEN HEALTH CHECKER                 ', 'bold');
    log('======================================================', 'cyan');

    let allPassed = true;

    // 1. Variáveis de Ambiente
    log('\n🔎 Verificando Variáveis de Ambiente:', 'yellow');
    const requiredVars = [
        'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
        'OPENAI_API_KEY', 'FAL_API_KEY', 'ELEVENLABS_API_KEY',
        'GOOGLE_CLIENT_ID', 'GOOGLE_DRIVE_FOLDER_ID'
    ];

    for (const v of requiredVars) {
        if (process.env[v] && process.env[v].length > 5) {
            log(`  [OK] ${v}`, 'green');
        } else {
            log(`  [FALHA] Variável ausente ou inválida: ${v}`, 'red');
            allPassed = false;
        }
    }

    // Opcionais
    if (process.env.ANTHROPIC_API_KEY) log(`  [INFO] ANTHROPIC_API_KEY configurada`, 'cyan');
    if (process.env.GEMINI_API_KEY) log(`  [INFO] GEMINI_API_KEY configurada`, 'cyan');

    // 2. FFmpeg Local
    log('\n⚙️  Verificando Binários Locais:', 'yellow');
    try {
        const cmd = process.env.FFMPEG_PATH ? `"${process.env.FFMPEG_PATH}" -version` : 'ffmpeg -version';
        const ffmpegOutput = execSync(cmd).toString().split('\n')[0];
        log(`  [OK] FFmpeg Instalado: ${ffmpegOutput.substring(0, 30)}...`, 'green');
    } catch (e) {
        log(`  [FALHA] FFmpeg não encontrado no PATH nem no FFMPEG_PATH.`, 'red');
        allPassed = false;
    }

    // 3. Diretórios de Trabalho
    log('\n📁 Verificando Sistema de Arquivos:', 'yellow');
    const dirs = [
        path.join(process.cwd(), 'data'),
        path.join(process.cwd(), 'data', 'inputs'),
        path.join(process.cwd(), 'data', 'video'),
        path.join(process.cwd(), 'data', 'audio')
    ];

    for (const d of dirs) {
        try {
            await fs.ensureDir(d);
            await fs.access(d, fs.constants.R_OK | fs.constants.W_OK);
            log(`  [OK] R/W Access: ${path.basename(d) || 'data'}`, 'green');
        } catch (e) {
            log(`  [FALHA] Sem permissão/erro no diretório: ${path.basename(d)}`, 'red');
            allPassed = false;
        }
    }

    // 4. Integrações Dinâmicas (APIs)
    log('\n🌐 Pingando Serviços Externos:', 'yellow');

    // Supabase
    allPassed &= await testPing('Supabase', async () => {
        const { error } = await supabaseAdmin.from('criativos_finais').select('id').limit(1);
        if (error) throw error;
    });

    // OpenAI
    if (process.env.OPENAI_API_KEY) {
        allPassed &= await testPing('OpenAI API', async () => {
            const { OpenAI } = await import('openai');
            const o = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            await o.models.list();
        });
    }

    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
        await testPing('Anthropic API', async () => {
            const { default: Anthropic } = await import('@anthropic-ai/sdk');
            const a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            await a.models.list();
        });
    }

    // ElevenLabs
    if (process.env.ELEVENLABS_API_KEY) {
        allPassed &= await testPing('ElevenLabs API', async () => {
            const { listVoices } = await import('../tools/elevenlabs-client.js');
            const v = await listVoices();
            if (!v || v.length === 0) throw new Error('Nenhuma voz encontrada');
        });
    }

    // Runway / Alibaba / etc check
    log('\n🛠️ Fal.ai / Runway (Opcional): Chaves presentes, verificar Dashboard.', 'cyan');

    log('\n======================================================', 'cyan');
    if (allPassed) {
        log('🟢 SISTEMA 100% OPERACIONAL: HEALTH CHECK PASSOU', 'green');
        return true;
    } else {
        log('🔴 ATENÇÃO: ERROS DETECTADOS NO HEALTH CHECK. Verifique os logs.', 'red');
        return false;
    }
}
