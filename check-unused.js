import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

// Configuration matching your build.js
const SIZES = [400, 800, 1200, 1600];
const GENERATED_REGEX = new RegExp(`-(${SIZES.join('|')})\\.(jpg|jpeg|png|webp)$`, 'i');

async function findUnusedImages() {
    console.log('🔍 Scanning project for unused images...');

    // 1. Find all images in the image folder
    const allImages = await glob('image/**/*.{jpg,jpeg,png,webp,svg,gif,JPG,JPEG,PNG,WEBP,SVG,GIF}');
    
    // 2. Filter out the auto-generated versions (artifacts)
    // We only want to check if the *source* images are used.
    const sourceImages = allImages.filter(img => !GENERATED_REGEX.test(img));

    console.log(`   Found ${sourceImages.length} source images.`);

    // 3. Read all code files where images might be referenced
    const codeFiles = await glob('**/*.{html,css,js,json}', { 
        ignore: ['node_modules/**', 'check-unused.js', 'build.js', 'package-lock.json'] 
    });

    let allCodeContent = '';
    for (const file of codeFiles) {
        allCodeContent += await fs.readFile(file, 'utf-8');
    }

    // 4. Check each source image
    const unusedImages = [];

    for (const imgPath of sourceImages) {
        const filename = path.basename(imgPath);
        const nameWithoutExt = path.parse(filename).name;
        const sanitizedName = nameWithoutExt.replace(/\s+/g, '-'); // Handle spaces like build.js

        if (!allCodeContent.includes(sanitizedName)) {
            unusedImages.push(imgPath);
        }
    }

    if (unusedImages.length === 0) {
        console.log('\n✅ Great news! All source images appear to be used.');
    } else {
        console.log(`\n⚠️  Found ${unusedImages.length} images that might be unused:`);
        unusedImages.forEach(img => console.log(`   - ${img}`));

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => rl.question('\n🗑️  Do you want to delete these files? (y/N) ', resolve));
        rl.close();

        if (answer.trim().toLowerCase() === 'y') {
            console.log('\nDeleting...');
            for (const img of unusedImages) {
                await fs.unlink(img);
                console.log(`   Deleted: ${img}`);
            }
            console.log('✅ Cleanup complete.');
        } else {
            console.log('❌ Cancelled.');
        }
    }
}

findUnusedImages().catch(console.error);