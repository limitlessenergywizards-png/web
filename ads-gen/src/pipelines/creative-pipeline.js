import readline from 'readline';
import { logger } from '../utils/logger.js';
import { parseCopy } from '../tools/copy-parser.js';
import { storyboardAgent } from '../agents/storyboard.agent.js';
import { avatarAgent } from '../agents/avatar.agent.js';
import { animationAgent } from '../agents/animation.agent.js';
import { audioAgent } from '../agents/audio.agent.js';
import { editorAgent } from '../agents/editor.agent.js';
import driveUploader from '../tools/drive-uploader.js';
import { logFase, atualizarStatus, buscarBriefing, listarLogs } from '../db/dal.js';
import { withTimeout } from '../utils/retry.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

export class CreativePipeline {
    constructor() {
        this.fases = [
            { num: 1, id: 'parse', desc: 'Copy Parsing', run: this.faseParse.bind(this) },
            { num: 2, id: 'storyboard', desc: 'Storyboard Generation', run: this.faseStoryboard.bind(this) },
            { num: 3, id: 'avatar', desc: 'Avatar Generation', run: this.faseAvatar.bind(this) },
            { num: 4, id: 'animacao', desc: 'Animation Generation', run: this.faseAnimacao.bind(this) },
            { num: 5, id: 'audio', desc: 'Audio Generation', run: this.faseAudio.bind(this) },
            { num: 6, id: 'edicao', desc: 'Video Editing & Assembly', run: this.faseEdicao.bind(this) },
            { num: 7, id: 'entrega', desc: 'Delivery (Google Drive)', run: this.faseEntrega.bind(this) },
        ];
    }

    async run(briefingId, opcoes = {}) {
        const { modo = 'auto', pularFases = [] } = opcoes;
        logger.info(`\n🚀 [Pipeline] Iniciando Briefing: ${briefingId} (Modo: ${modo})`);

        try {
            // Recovery logic
            const logs = await listarLogs(briefingId);
            const concluídas = logs.filter(l => l.status === 'sucesso').map(l => l.fase);
            const fIncial = this.fases.find(f => !concluídas.includes(f.id) && !pularFases.includes(f.id));

            if (!fIncial) {
                logger.info(`[Pipeline] ✅ Todas as fases já concluídas ou puladas.`);
                await atualizarStatus(briefingId, 'concluido');
                return { success: true };
            }

            logger.info(`[Pipeline] Retomando da fase: ${fIncial.num} - ${fIncial.desc}`);
            await atualizarStatus(briefingId, 'em_andamento');

            let deliveryResults = null;

            for (const fase of this.fases) {
                if (fase.num < fIncial.num || pularFases.includes(fase.id)) {
                    logger.info(`[Pipeline] ⏭️ Pulando Fase ${fase.num}: ${fase.desc}`);
                    continue;
                }

                // Sem-auto pause
                if (modo === 'semi-auto') {
                    const ans = await askQuestion(`\n[Semi-Auto] Iniciar Fase ${fase.num} (${fase.desc})? [S/n]: `);
                    if (ans.toLowerCase() === 'n') {
                        logger.info(`[Pipeline] 🛑 Parado pelo usuário.`);
                        return { success: false, reason: 'user_aborted' };
                    }
                }

                logger.info(`\n==============================================`);
                logger.info(`⏳ FASE ${fase.num} [${fase.id}] → ${fase.desc}`);
                logger.info(`==============================================`);

                await logFase({ projeto_id: briefingId, fase: fase.id, status: 'iniciado' }); // Using briefingId as projeto_id for logs

                try {
                    // Global Phase Timeout: 10 minutes
                    const result = await withTimeout(fase.run(briefingId), 10 * 60 * 1000);
                    if (fase.id === 'entrega') deliveryResults = result;

                    await logFase({ projeto_id: briefingId, fase: fase.id, status: 'sucesso' });
                } catch (error) {
                    logger.error(`[Pipeline] ❌ Erro na Fase ${fase.num}: ${error.message}`);
                    await logFase({
                        projeto_id: briefingId,
                        fase: fase.id,
                        status: 'erro',
                        dados: { erro: error.message, stack: error.stack }
                    });
                    await atualizarStatus(briefingId, 'erro');
                    return { success: false, error: error.message };
                }
            }

            logger.info(`\n🎉 [Pipeline] Concluído com Sucesso!`);
            await atualizarStatus(briefingId, 'concluido');

            return { success: true, delivery: deliveryResults };

        } catch (err) {
            logger.error(`[Pipeline] 💥 Erro Fatal: ${err.message}`);
            await atualizarStatus(briefingId, 'erro');
            return { success: false, error: err.message };
        }
    }

    // --- Fase Handlers ---

    async faseParse(briefingId) {
        const briefing = await buscarBriefing(briefingId);
        if (!briefing || !briefing.copy_original) throw new Error('Briefing ou copy original não encotrado.');
        await parseCopy(briefingId, briefing.copy_original);
        return true;
    }

    async faseStoryboard(briefingId) {
        return await storyboardAgent.generate(briefingId);
    }

    async faseAvatar(briefingId) {
        return await avatarAgent.generate(briefingId);
    }

    async faseAnimacao(briefingId) {
        return await animationAgent.animate(briefingId);
    }

    async faseAudio(briefingId) {
        return await audioAgent.generate(briefingId);
    }

    async faseEdicao(briefingId) {
        return await editorAgent.edit(briefingId);
    }

    async faseEntrega(briefingId) {
        return await driveUploader.uploadTodos(briefingId);
    }
}

export default new CreativePipeline();
