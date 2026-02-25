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

const filesToProcess = getAllFiles(path.join(process.cwd(), 'src/infrastructure'));

const bumpFolders = ['utils', 'config', 'tools', 'agents', 'db', 'pipelines', 'dashboard'];

filesToProcess.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    bumpFolders.forEach(folder => {
        // replace `../folder/` with `../../folder/`
        // using regex to match quotes
        const regex = new RegExp(`(['"])\\.\\.\\/${folder}\\/`, 'g');
        content = content.replace(regex, `$1../../${folder}/`);
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log('Updated depths in:', filePath);
    }
});

console.log('Depth fixing complete.');
