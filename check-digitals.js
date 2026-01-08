import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';

async function checkDigitals() {
    console.log('🔍 Checking for missing digital images (01, 02, 03, 04)...');
    console.log('-'.repeat(50));

    // Find all model folders inside women and men directories
    const modelDirs = await glob('image/models/{men,women}/*/');

    if (modelDirs.length === 0) {
        console.log('⚠️  No model directories found.');
        return;
    }

    let allGood = true;

    for (const dir of modelDirs) {
        const modelName = path.basename(dir);
        const digitalsPath = path.join(dir, 'Digitals');
        
        // Check if Digitals folder exists
        try {
            await fs.access(digitalsPath);
        } catch {
            console.log(`❌ ${modelName.padEnd(10)} | Missing 'Digitals' folder`);
            allGood = false;
            continue;
        }

        const missing = [];
        for (let i = 1; i <= 4; i++) {
            const num = i.toString().padStart(2, '0'); // "01", "02"...
            
            // Check for file with any common image extension
            // We use glob here because we don't know if it's .jpg, .png, etc.
            const matches = await glob(`${digitalsPath}/${num}.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}`);
            
            if (matches.length === 0) {
                missing.push(num);
            }
        }

        if (missing.length > 0) {
            console.log(`⚠️  ${modelName.padEnd(10)} | Missing images: ${missing.join(', ')}`);
            allGood = false;
        } else {
            console.log(`✅ ${modelName.padEnd(10)} | OK`);
        }
    }

    console.log('-'.repeat(50));
}

checkDigitals().catch(console.error);