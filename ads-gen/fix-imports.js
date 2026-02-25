import fs from 'fs';
import path from 'path';

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

const filesToProcess = getAllFiles(process.cwd());

const movedFiles = {
    'src/db/dal.js': 'src/infrastructure/database/dal.js',
    'src/db/supabase.js': 'src/infrastructure/database/supabase.js',
    'src/tools/storage-uploader.js': 'src/infrastructure/storage/storage-uploader.js',
    'src/tools/drive-uploader.js': 'src/infrastructure/storage/drive-uploader.js',
    'src/utils/rendi-client.js': 'src/infrastructure/cloud-compute/rendi-client.js'
};

const regexes = [
    { match: /['"]\.\.\/db\/(.+?)['"]/g, oldPath: 'src/db', resolveBase: 'src/tools' },
    { match: /['"]\.\/src\/db\/(.+?)['"]/g, oldPath: 'src/db', resolveBase: '.' },
    { match: /['"]\.\.\/tools\/(storage-uploader|drive-uploader)\.js['"]/g, oldPath: 'src/tools', resolveBase: 'src/agents' },
    { match: /['"]\.\/src\/tools\/(storage-uploader|drive-uploader)\.js['"]/g, oldPath: 'src/tools', resolveBase: '.' },
    { match: /['"]\.\.\/utils\/rendi-client\.js['"]/g, oldPath: 'src/utils', resolveBase: 'src/tools' }
];

filesToProcess.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // Manual fast replacements
    // Anything looking for ../db/dal.js
    content = content.replace(/['"]\.\.\/db\/dal\.js['"]/g, (match) => {
        // Calculate relative path from this file's new location to src/infrastructure/database/dal.js
        const dir = path.dirname(filePath);
        const target = path.resolve(process.cwd(), 'src/infrastructure/database/dal.js');
        let rel = path.relative(dir, target);
        if (!rel.startsWith('.')) rel = './' + rel;
        return `'${rel}'`;
    });

    content = content.replace(/['"]\.\.\/db\/supabase\.js['"]/g, (match) => {
        const dir = path.dirname(filePath);
        const target = path.resolve(process.cwd(), 'src/infrastructure/database/supabase.js');
        let rel = path.relative(dir, target);
        if (!rel.startsWith('.')) rel = './' + rel;
        return `'${rel}'`;
    });

    content = content.replace(/['"]\.\.\/tools\/storage-uploader\.js['"]/g, (match) => {
        const dir = path.dirname(filePath);
        const target = path.resolve(process.cwd(), 'src/infrastructure/storage/storage-uploader.js');
        let rel = path.relative(dir, target);
        if (!rel.startsWith('.')) rel = './' + rel;
        return `'${rel}'`;
    });

    content = content.replace(/['"]\.\.\/tools\/drive-uploader\.js['"]/g, (match) => {
        const dir = path.dirname(filePath);
        const target = path.resolve(process.cwd(), 'src/infrastructure/storage/drive-uploader.js');
        let rel = path.relative(dir, target);
        if (!rel.startsWith('.')) rel = './' + rel;
        return `'${rel}'`;
    });

    content = content.replace(/['"]\.\.\/utils\/rendi-client\.js['"]/g, (match) => {
        const dir = path.dirname(filePath);
        const target = path.resolve(process.cwd(), 'src/infrastructure/cloud-compute/rendi-client.js');
        let rel = path.relative(dir, target);
        if (!rel.startsWith('.')) rel = './' + rel;
        return `'${rel}'`;
    });

    // Also handle index.js or tests importing from './src...'
    content = content.replace(/['"]\.\/src\/db\/dal\.js['"]/g, "'./src/infrastructure/database/dal.js'");
    content = content.replace(/['"]\.\/src\/db\/supabase\.js['"]/g, "'./src/infrastructure/database/supabase.js'");
    content = content.replace(/['"]\.\/src\/tools\/storage-uploader\.js['"]/g, "'./src/infrastructure/storage/storage-uploader.js'");
    content = content.replace(/['"]\.\/src\/tools\/drive-uploader\.js['"]/g, "'./src/infrastructure/storage/drive-uploader.js'");

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log('Updated imports in:', filePath);
    }
});

console.log('Import fixing complete.');
