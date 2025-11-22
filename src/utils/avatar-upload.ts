/*
Copyright 2024 New Vector Ltd.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

const SUPPORTED_IMAGE_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
]);

const IMAGE_EXTENSION_REGEX = /\.(jpe?g|png|gif|bmp|tiff?|webp|heic|heif|hif|avif|svg|ico)$/i;
const MAX_AVATAR_DIMENSION = 1024;
const MIN_SCALE = 0.2;

function ensureJpegFilename(name: string): string {
    const base = name.replace(/\.[^/.]+$/, "") || "avatar";
    return `${base}.jpg`;
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(img);
        };
        img.onerror = err => {
            URL.revokeObjectURL(objectUrl);
            logger.warn("Failed to decode avatar file, skipping conversion", err);
            resolve(null);
        };
        img.src = objectUrl;
    });
}

async function canvasEncode(
    img: HTMLImageElement,
    scale: number,
    quality: number,
): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), "image/jpeg", quality);
    });
}

async function convertToSupportedType(file: File): Promise<{ file: File; image: HTMLImageElement | null }> {
    const image = await loadImageFromFile(file);

    if (!image) {
        return { file, image: null };
    }

    if (SUPPORTED_IMAGE_TYPES.has(file.type)) {
        return { file, image };
    }

    const blob = await canvasEncode(image, 1, 0.92);
    if (!blob) {
        throw new Error("AVATAR_CONVERSION_FAILED");
    }

    return {
        file: new File([blob], ensureJpegFilename(file.name), { type: "image/jpeg" }),
        image,
    };
}

export function isLikelyImageFile(file: File): boolean {
    if (file.type && file.type.startsWith("image/")) return true;
    return IMAGE_EXTENSION_REGEX.test(file.name);
}

export async function prepareAvatarFile(file: File, maxBytes?: number): Promise<File> {
    const { file: normalizedFile, image } = await convertToSupportedType(file);

    if (!image || !maxBytes || normalizedFile.size <= maxBytes) {
        return normalizedFile;
    }

    const longestSide = Math.max(image.width, image.height) || 1;
    let initialScale = Math.min(1, MAX_AVATAR_DIMENSION / longestSide);
    if (!isFinite(initialScale) || initialScale <= 0) {
        initialScale = 1;
    }

    for (let currentScale = initialScale; currentScale >= MIN_SCALE; currentScale -= 0.1) {
        for (let quality = 0.92; quality >= 0.4; quality -= 0.1) {
            const blob = await canvasEncode(image, currentScale, Number(quality.toFixed(2)));
            if (!blob) continue;
            if (blob.size <= maxBytes) {
                return new File([blob], ensureJpegFilename(file.name), { type: "image/jpeg" });
            }
        }
    }

    return normalizedFile;
}



