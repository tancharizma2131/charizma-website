import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';

async function createDigitalsFolders() {
    console.log('🚀 Scanning for model directories...');

    // Find all model folders inside women and men directories
    // The pattern ends with '/' to ensure we only match directories
    const modelDirs = await glob('image/models/{men,women}/*/');

    if (modelDirs.length === 0) {
        console.log('⚠️  No model directories found.');
        return;
    }

    console.log(`   Found ${modelDirs.length} models.`);

    for (const dir of modelDirs) {
        const digitalsPath = path.join(dir, 'Digitals');
        
        try {
            // recursive: true prevents errors if the folder already exists
            await fs.mkdir(digitalsPath, { recursive: true });
            console.log(`   ✅ Ready: ${digitalsPath}`);
        } catch (error) {
            console.error(`   ❌ Error creating ${digitalsPath}:`, error.message);
        }
    }

    console.log('\n✨ Done! You can now drop images into these folders.');
}

createDigitalsFolders().catch(console.error);