import * as faceapi from 'face-api.js';
import { Canvas, Image, ImageData, createCanvas, loadImage } from 'canvas';
import path from 'path';
import fs from 'fs';

// Patch face-api.js environment for Node.js
// @ts-ignore
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

export class FaceService {
    private static modelsLoaded = false;
    private static readonly MODELS_PATH = path.join(process.cwd(), 'public', 'models');
    private static readonly MATCH_THRESHOLD = 0.6; // Euclidean distance threshold (lower is stricter)

    /**
     * Initialize and load models
     */
    static async initialize() {
        if (this.modelsLoaded) return;

        try {
            if (!fs.existsSync(this.MODELS_PATH)) {
                console.warn('Face API models directory not found at:', this.MODELS_PATH);
                // Fallback or create directory?
                // For now, we just warn. Verification will fail or return mock result if models aren't there.
                return;
            }

            await faceapi.nets.ssdMobilenetv1.loadFromDisk(this.MODELS_PATH);
            await faceapi.nets.faceLandmark68Net.loadFromDisk(this.MODELS_PATH);
            await faceapi.nets.faceRecognitionNet.loadFromDisk(this.MODELS_PATH);

            this.modelsLoaded = true;
            console.log('Face API models loaded successfully');
        } catch (error) {
            console.error('Failed to load Face API models:', error);
        }
    }

    /**
     * Get face descriptor from an image buffer or base64 string
     */
    static async getFaceDescriptor(imageInput: Buffer | string): Promise<Float32Array | null> {
        if (!this.modelsLoaded) await this.initialize();

        try {
            let image: any;
            if (Buffer.isBuffer(imageInput)) {
                image = await loadImage(imageInput);
            } else if (typeof imageInput === 'string') {
                // Remove data URL prefix if present
                const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                image = await loadImage(buffer);
            } else {
                throw new Error('Invalid image input');
            }

            const detections = await faceapi.detectSingleFace(image).withFaceLandmarks().withFaceDescriptor();

            return detections ? detections.descriptor : null;
        } catch (error) {
            console.error('Error getting face descriptor:', error);
            return null;
        }
    }

    /**
     * Verify a face against a stored descriptor
     * @param imageInput The new image (Selfie)
     * @param storedDescriptor The stored descriptor (from Registration)
     */
    static async verifyFace(imageInput: Buffer | string, storedDescriptor: number[] | object): Promise<{ isMatch: boolean; score: number }> {
        if (!storedDescriptor) {
            throw new Error('No stored face descriptor found for user');
        }

        const newDescriptor = await this.getFaceDescriptor(imageInput);

        if (!newDescriptor) {
            // Could not detect face in the new image
            throw new Error('No face detected in the provided image');
        }

        // Convert stored JSON/Array back to Float32Array
        const storedFloat32 = new Float32Array(Object.values(storedDescriptor));

        const distance = faceapi.euclideanDistance(newDescriptor, storedFloat32);

        // Distance 0 means exact match, higher means different.
        // Usually < 0.6 is a match.
        return {
            isMatch: distance < this.MATCH_THRESHOLD,
            score: distance // Lower is better
        };
    }
}
