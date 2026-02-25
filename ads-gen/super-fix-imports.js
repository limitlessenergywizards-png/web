import fs from 'fs';
import path from 'path';

// Known target absolute paths (relative to project root)
const TARGETS = {
    'dal.js': 'src/infrastructure/database/dal.js',
    'supabase.js': 'src/infrastructure/database/supabase.js',
    'logger.js': 'src/utils/logger.js',
    'retry.js': 'src/utils/retry.js',
    'env-validator.js': 'src/utils/env-validator.js',
    'storage-uploader.js': 'src/infrastructure/storage/storage-uploader.js',
    'drive-uploader.js': 'src/infrastructure/storage/drive-uploader.js',
    'rendi-client.js': 'src/infrastructure/cloud-compute/rendi-client.js',
    'ai-provider.js': 'src/utils/ai-provider.js',
    'creative-pipeline.js': 'src/modules/production/pipeline.js', // renamed
    'pipeline.js': 'src/modules/production/pipeline.js',
    'batch-processor.js': 'src/modules/production/batch-processor.js',
    'api-contracts.js': 'src/config/api-contracts.js',
    'video-models.js': 'src/config/video-models.js',
    // Media / Assembly
    'audio-factory.js': 'src/modules/media/audio/audio-factory.js',
    'elevenlabs-client.js': 'src/modules/media/audio/elevenlabs-client.js',
    'audio-generator.js': 'src/modules/media/audio/audio-generator.js',
    'audio.agent.js': 'src/modules/media/audio/audio.agent.js',
    'avatar.agent.js': 'src/modules/media/image/avatar.agent.js',
    'avatar-generator.js': 'src/modules/media/image/avatar-generator.js',
    'avatar-matcher.js': 'src/modules/media/image/avatar-matcher.js',
    'video.agent.js': 'src/modules/media/video/video.agent.js',
    'animation.agent.js': 'src/modules/media/video/animation.agent.js',
    'helix-client.js': 'src/modules/media/video/helix-client.js',
    'runway-client.js': 'src/modules/media/video/runway-client.js',
    'video-generator.js': 'src/modules/media/video/video-generator.js',
    'video-animator.js': 'src/modules/media/video/video-animator.js',
    'model-recommender.js': 'src/modules/media/video/model-recommender.js',
    'editor.agent.js': 'src/modules/assembly/editor.agent.js',
    'editor.js': 'src/modules/assembly/editor.js',
    'video-editor.js': 'src/modules/assembly/editor.js', // renamed to editor.js
    'audio-processor.js': 'src/modules/assembly/audio-processor.js',
    'music-selector.js': 'src/modules/assembly/music-selector.js',
    'sync-calculator.js': 'src/modules/assembly/sync-calculator.js',
    'video-concatenator.js': 'src/modules/assembly/video-concatenator.js',
    'video-selector.js': 'src/modules/assembly/video-selector.js',
    // Briefing
    'storyboard.prompt.js': 'src/modules/briefing/templates/storyboard.prompt.js',
    'storyboard.agent.js': 'src/modules/briefing/use-cases/storyboard.agent.js',
    'copy-parser.js': 'src/modules/briefing/use-cases/copy-parser.js',
    'scene-parser.js': 'src/modules/briefing/domain/scene-parser.js'
};

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
            }
        } else {
            if (file.endsWith('.js') || file.endsWith('.ts')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });
    return arrayOfFiles;
}

const filesToProcess = getAllFiles(path.join(process.cwd(), 'src'));
filesToProcess.push(path.join(process.cwd(), 'index.js')); // Include index.js

filesToProcess.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // Regex to find all imports: import { ... } from '... /filename.js';
    // or import name from '... /filename.js';
    const importRegex = /from\s+['"]([^'"]+\.js)['"]/g;

    content = content.replace(importRegex, (match, importPath) => {
        const fileName = path.basename(importPath);

        // If we have a known target for this filename, recompute the relative path
        if (TARGETS[fileName]) {
            const currentDir = path.dirname(filePath);
            const targetAbsPath = path.resolve(process.cwd(), TARGETS[fileName]);
            let rel = path.relative(currentDir, targetAbsPath);
            if (!rel.startsWith('.')) rel = './' + rel;
            return `from '${rel}'`;
        }

        return match;
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log('Fixed imports in:', filePath);
    }
});

console.log('Super Import fixing complete.');
