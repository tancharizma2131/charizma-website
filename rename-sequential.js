import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

/**
 * Helper function to ask a question in the console and get user input.
 * @param {string} query The question to display to the user.
 * @returns {Promise<string>} The user's answer.
 */
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function renameSequentially() {
    console.log('--- Sequential Image Renamer ---');
    
    const dirPath = await askQuestion('Enter the path to the folder containing images to rename: ');

    if (!dirPath) {
        console.log('❌ No path provided. Aborting.');
        return;
    }

    try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
            console.log(`❌ Error: "${dirPath}" is not a directory.`);
            return;
        }
    } catch (error) {
        console.log(`❌ Error accessing path "${dirPath}". Please check if it exists.`);
        return;
    }

    console.log(`\n🔍 Scanning for images in "${dirPath}"...`);
    const imagePaths = await glob(`${dirPath.replace(/\\/g, '/')}/*.{jpg,jpeg,png,webp,gif,JPG,JPEG,PNG,WEBP,GIF}`);

    if (imagePaths.length === 0) {
        console.log('No images found in that directory.');
        return;
    }

    imagePaths.sort();

    console.log(`\nFound ${imagePaths.length} images. Here is the proposed renaming plan:`);
    console.log('-'.repeat(50));

    const renamePlan = imagePaths.map((oldPath, index) => {
        const fileInfo = path.parse(oldPath);
        const newName = `${(index + 1).toString().padStart(2, '0')}${fileInfo.ext}`;
        const newPath = path.join(fileInfo.dir, newName);
        return { oldPath, newPath };
    });

    renamePlan.forEach(plan => console.log(`  ${path.basename(plan.oldPath)}  ->  ${path.basename(plan.newPath)}`));
    console.log('-'.repeat(50));

    const confirmation = await askQuestion('\n⚠️  This action is irreversible. Proceed with renaming? (y/N) ');

    if (confirmation.trim().toLowerCase() !== 'y') {
        console.log('❌ Renaming cancelled.');
        return;
    }

    console.log('\n🚀 Renaming files...');
    for (const { oldPath, newPath } of renamePlan) {
        try {
            await fs.rename(oldPath, newPath);
            console.log(`   - Renamed ${path.basename(oldPath)} to ${path.basename(newPath)}`);
        } catch (error) {
            console.error(`   - Error renaming ${path.basename(oldPath)}: ${error.message}`);
        }
    }
    console.log(`\n🎉 Done!`);
}

renameSequentially().catch(console.error);