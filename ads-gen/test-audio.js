/**
 * Test Audio Generation Pipeline
 * All files go ONLY to Supabase Storage — nothing saved locally in the project.
 */
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { logger } from './src/utils/logger.js';
import { buscarUltimoBriefing, listarCenas, salvarAudio } from './src/infrastructure/database/dal.js';
import { generateSpeech, listVoices } from './src/tools/elevenlabs-client.js';
import { normalizeVolume, getAudioDuration } from './src/tools/audio-processor.js';
import { uploadAudio, withTempFile } from './src/infrastructure/storage/storage-uploader.js';
import { calcularSincronizacaoBatch } from './src/tools/sync-calculator.js';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

function parseCopyToScenes(copyOriginal) {
    const sections = {};
    const regex = /\[(HOOK\s*\d+|BODY)\]\s*\n([\s\S]*?)(?=\n\[(?:HOOK|BODY)|$)/gi;
    let match;
    while ((match = regex.exec(copyOriginal)) !== null) {
        sections[match[1].trim().toUpperCase()] = match[2].trim();
    }
    return sections;
}

function getTextForScene(cena, copySections) {
    const tipo = cena.tipo.toUpperCase();
    if (tipo === 'HOOK') return copySections[`HOOK ${cena.ordem}`] || null;
    if (tipo === 'BODY') return copySections['BODY'] || null;
    return null;
}

async function runTest() {
    logger.info("=== AUDIO TEST (Supabase-only storage) ===", { phase: "TEST_START" });

    try {
        // 1. Pick a voice
        let voiceId = process.env.ELEVENLABS_VOICE_ID;
        if (!voiceId) {
            const voices = await listVoices();
            console.log("\n🎤 Available voices:");
            voices.slice(0, 5).forEach(v => console.log(`  ${v.name} (${v.voice_id})`));
            const pick = voices.find(v => v.name.toLowerCase().includes('sarah')) || voices[0];
            voiceId = pick.voice_id;
            console.log(`→ Using: ${pick.name} (${voiceId})\n`);
        }

        // 2. Get briefing + scenes
        const briefing = await buscarUltimoBriefing();
        if (!briefing) throw new Error("No briefing found.");
        const cenas = await listarCenas(briefing.id);
        const copySections = parseCopyToScenes(briefing.copy_original || '');

        console.log(`📄 Briefing: ${briefing.id} | ${cenas.length} scenes | Sections: ${Object.keys(copySections).join(', ')}`);

        // 3. Generate audio — temp files only, upload to Supabase Storage
        const results = [];
        let totalChars = 0, totalCost = 0;

        for (const cena of cenas) {
            const texto = getTextForScene(cena, copySections);
            if (!texto || texto.trim().length < 5) {
                console.log(`⏭️  [${cena.tipo.toUpperCase()} ${cena.ordem}] — skipping (no text)`);
                continue;
            }

            console.log(`\n🎙️  [${cena.tipo.toUpperCase()} ${cena.ordem}] "${texto.substring(0, 80)}..." (${texto.length} chars)`);

            // Process using temp files in /tmp
            await withTempFile('.mp3', async (rawTmp) => {
                await withTempFile('.mp3', async (normTmp) => {
                    const ttsResult = await generateSpeech(texto, voiceId);
                    await fs.writeFile(rawTmp, ttsResult.buffer);
                    totalChars += ttsResult.chars;
                    totalCost += ttsResult.cost;

                    await normalizeVolume(rawTmp, normTmp, -16);
                    const duracao = await getAudioDuration(normTmp);

                    // Upload to Supabase Storage
                    const fileName = `${briefing.id}/${cena.tipo}_${cena.ordem}.mp3`;
                    const uploaded = await uploadAudio(normTmp, fileName);

                    // Save to DB
                    try {
                        await salvarAudio({
                            cena_id: cena.id,
                            texto_narrado: texto,
                            voice_id: voiceId,
                            voice_nome: 'ElevenLabs Premade',
                            modelo_usado: 'eleven_multilingual_v2',
                            custo_usd: ttsResult.cost,
                            duracao_geracao_ms: ttsResult.elapsed,
                            duracao_segundos: duracao,
                            arquivo_path: uploaded.url,
                            status: 'pronto'
                        });
                    } catch (e) {
                        console.log(`  ⚠️  DB: ${e.message}`);
                    }

                    results.push({
                        tipo: cena.tipo, ordem: cena.ordem,
                        chars: texto.length, duracao, cost: ttsResult.cost,
                        url: uploaded.url
                    });

                    console.log(`  ✅ ${duracao.toFixed(1)}s | $${ttsResult.cost.toFixed(3)} | ☁️ ${uploaded.url.split('/').slice(-2).join('/')}`);
                });
            });
        }

        // 4. Report
        console.log("\n\n══════════════════════════════════════");
        console.log("🎬 AUDIO GENERATION REPORT");
        console.log("══════════════════════════════════════");
        console.log(`📁 Storage: Supabase ONLY (zero local files)`);
        console.log(`🎙️  Scenes: ${results.length}/${cenas.length}`);
        console.log(`📝 Characters: ${totalChars}`);
        console.log(`💰 Cost: $${totalCost.toFixed(3)}`);
        console.log(`\n📊 Per scene:`);
        results.forEach(r => console.log(`  [${r.tipo.toUpperCase()} ${r.ordem}] ${r.duracao.toFixed(1)}s | ${r.chars} chars | $${r.cost.toFixed(3)}`));
        console.log(`\n⏱️  Total duration: ${results.reduce((s, r) => s + r.duracao, 0).toFixed(1)}s`);

        // 5. Sync check
        console.log("\n📐 Sync (hooks=5s, body=30s video):");
        const sync = calcularSincronizacaoBatch(results.map(r => ({
            cenaId: `${r.tipo.toUpperCase()} ${r.ordem}`,
            videoDuracao: r.tipo === 'hook' ? 5 : 30,
            audioDuracao: r.duracao
        })));
        sync.results.forEach(s => {
            const icon = s.acao === 'ok' ? '✅' : s.acao === 'ajustar_velocidade' ? '🔧' : '⚠️';
            console.log(`  ${icon} ${s.cenaId}: ${s.audioDuracao}s vs ${s.videoDuracao}s → ×${s.fatorVelocidade.toFixed(2)} — ${s.acao}`);
        });

    } catch (error) {
        logger.error(`Test failed: ${error.message}`, { phase: "TEST_ERROR" });
        console.error(error.stack);
    } finally {
        process.exit(0);
    }
}

runTest();
