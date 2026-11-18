import crypto from 'node:crypto';
import type {
  CustomFontRecord,
  FontFileFormat,
  FontLibraryManifest,
} from '../../shared/types/fonts.js';
import { HttpError } from '../middleware/errorMiddleware.js';
import type { StorageProvider } from './storage/storageProvider.js';

const MAX_FONT_BYTES = 64 * 1024 * 1024;
const ALLOWED_FONT_FORMATS = new Set<FontFileFormat>(['ttf', 'otf', 'ttc']);

export function sanitizeFontFileName(rawName: string): { fileName: string; format: FontFileFormat; stem: string } {
  const leaf = (rawName || '').split(/[\\/]/).pop() || '';
  const dotIdx = leaf.lastIndexOf('.');
  const ext = (dotIdx > 0 ? leaf.slice(dotIdx + 1) : '').toLowerCase();
  if (!ALLOWED_FONT_FORMATS.has(ext as FontFileFormat)) {
    throw new HttpError(
      400,
      `Unsupported font format (.${ext || 'unknown'}). Only .ttf, .otf, and .ttc fonts are supported.`,
      'UNSUPPORTED_FONT_FORMAT'
    );
  }
  const rawStem = dotIdx > 0 ? leaf.slice(0, dotIdx) : leaf;
  const stem =
    rawStem
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'custom-font';
  return {
    fileName: `${stem}.${ext}`,
    format: ext as FontFileFormat,
    stem,
  };
}

export function validateFontMagicBytes(buffer: Buffer, format: FontFileFormat): void {
  if (buffer.length < 12) {
    throw new HttpError(400, 'Font file is empty or truncated', 'INVALID_FONT_DATA');
  }
  if (buffer.length > MAX_FONT_BYTES) {
    throw new HttpError(413, 'Font file exceeds 64 MB limit', 'FONT_TOO_LARGE');
  }

  const tag = buffer.subarray(0, 4);
  const tagAscii = tag.toString('ascii');
  const isTtfSig =
    (tag[0] === 0x00 && tag[1] === 0x01 && tag[2] === 0x00 && tag[3] === 0x00) ||
    tagAscii === 'true';
  const isOtfSig = tagAscii === 'OTTO';
  const isTtcSig = tagAscii === 'ttcf';

  if (format === 'ttc' && !isTtcSig) {
    throw new HttpError(400, 'Invalid TrueType Collection (.ttc) header signature', 'INVALID_FONT_MAGIC');
  }
  if ((format === 'ttf' || format === 'otf') && !isTtfSig && !isOtfSig) {
    throw new HttpError(400, 'Invalid OpenType/TrueType font signature', 'INVALID_FONT_MAGIC');
  }
}

function parseSfntMetadata(buffer: Buffer, fallbackStem: string): {
  familyName: string;
  styleName: string;
  postScriptName: string;
  isMonospace: boolean;
} {
  const defaults = {
    familyName: fallbackStem.replace(/[-_]+/g, ' '),
    styleName: 'Regular',
    postScriptName: fallbackStem.replace(/[^a-zA-Z0-9-]/g, ''),
    isMonospace: /mono|code|courier|consolas|fira|jetbrains/i.test(fallbackStem),
  };

  try {
    let sfntOffset = 0;
    if (buffer.subarray(0, 4).toString('ascii') === 'ttcf' && buffer.length >= 16) {
      sfntOffset = buffer.readUInt32BE(12);
    }
    if (sfntOffset + 12 > buffer.length) return defaults;

    const numTables = buffer.readUInt16BE(sfntOffset + 4);
    if (numTables > 128 || sfntOffset + 12 + numTables * 16 > buffer.length) return defaults;

    let nameTableOffset = 0;
    let nameTableLength = 0;
    let postTableOffset = 0;
    let postTableLength = 0;

    for (let i = 0; i < numTables; i += 1) {
      const recOffset = sfntOffset + 12 + i * 16;
      const tag = buffer.subarray(recOffset, recOffset + 4).toString('ascii');
      const offset = buffer.readUInt32BE(recOffset + 8);
      const length = buffer.readUInt32BE(recOffset + 12);
      if (tag === 'name') {
        nameTableOffset = offset;
        nameTableLength = length;
      } else if (tag === 'post') {
        postTableOffset = offset;
        postTableLength = length;
      }
    }

    let isMonospace = defaults.isMonospace;
    if (postTableOffset > 0 && postTableLength >= 16 && postTableOffset + 16 <= buffer.length) {
      const isFixedPitch = buffer.readUInt32BE(postTableOffset + 12);
      isMonospace = isFixedPitch !== 0;
    }

    let familyName = defaults.familyName;
    let styleName = defaults.styleName;
    let postScriptName = defaults.postScriptName;

    if (nameTableOffset > 0 && nameTableLength >= 6 && nameTableOffset + nameTableLength <= buffer.length) {
      const count = buffer.readUInt16BE(nameTableOffset + 2);
      const stringOffset = buffer.readUInt16BE(nameTableOffset + 4);
      const storageStart = nameTableOffset + stringOffset;

      for (let i = 0; i < count; i += 1) {
        const nr = nameTableOffset + 6 + i * 12;
        if (nr + 12 > nameTableOffset + nameTableLength) break;
        const platformId = buffer.readUInt16BE(nr);
        const nameId = buffer.readUInt16BE(nr + 6);
        const len = buffer.readUInt16BE(nr + 8);
        const off = buffer.readUInt16BE(nr + 10);
        if (storageStart + off + len > buffer.length) continue;
        if (nameId !== 1 && nameId !== 2 && nameId !== 6) continue;

        const slice = buffer.subarray(storageStart + off, storageStart + off + len);
        let decoded = '';
        if (platformId === 3 || platformId === 0) {
          // UTF-16BE
          const swapped = Buffer.alloc(slice.length);
          for (let j = 0; j + 1 < slice.length; j += 2) {
            swapped[j] = slice[j + 1];
            swapped[j + 1] = slice[j];
          }
          decoded = swapped.toString('utf16le').replace(/\0/g, '').trim();
        } else if (platformId === 1) {
          decoded = slice.toString('latin1').replace(/\0/g, '').trim();
        }

        if (!decoded) continue;
        if (nameId === 1) familyName = decoded;
        else if (nameId === 2) styleName = decoded;
        else if (nameId === 6) postScriptName = decoded;
      }
    }

    return { familyName, styleName, postScriptName, isMonospace };
  } catch {
    return defaults;
  }
}

export class FontStorageService {
  private readonly storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  private manifestKey(userId: string): string {
    return `users/${userId}/fonts/fonts.json`;
  }

  private fontObjectKey(userId: string, fontId: string, fileName: string): string {
    return `users/${userId}/fonts/${fontId}-${fileName}`;
  }

  private async readManifest(userId: string): Promise<FontLibraryManifest> {
    const obj = await this.storage.getObject(this.manifestKey(userId));
    if (!obj) {
      return { schemaVersion: 1, fonts: [] };
    }
    return JSON.parse(obj.body.toString('utf8')) as FontLibraryManifest;
  }

  private async writeManifest(userId: string, manifest: FontLibraryManifest): Promise<void> {
    await this.storage.putObject(
      this.manifestKey(userId),
      JSON.stringify(manifest, null, 2),
      'application/json'
    );
  }

  async listFonts(userId: string): Promise<CustomFontRecord[]> {
    const manifest = await this.readManifest(userId);
    return manifest.fonts;
  }

  async uploadFont(
    userId: string,
    originalName: string,
    buffer: Buffer,
    overrides?: { displayName?: string; familyName?: string; isMonospace?: boolean }
  ): Promise<CustomFontRecord> {
    const { fileName, format, stem } = sanitizeFontFileName(originalName);
    validateFontMagicBytes(buffer, format);

    const parsed = parseSfntMetadata(buffer, stem);
    const id = crypto.randomUUID();
    const record: CustomFontRecord = {
      id,
      displayName: (overrides?.displayName || parsed.familyName || stem).trim().slice(0, 100),
      familyName: (overrides?.familyName || parsed.familyName || stem).trim().slice(0, 100),
      postScriptName: parsed.postScriptName,
      styleName: parsed.styleName,
      fileName,
      format,
      isMonospace: overrides?.isMonospace ?? parsed.isMonospace,
      fileSizeBytes: buffer.length,
      addedAt: new Date().toISOString(),
    };

    const contentType =
      format === 'otf' ? 'font/otf' : format === 'ttf' ? 'font/ttf' : 'font/collection';
    await this.storage.putObject(this.fontObjectKey(userId, id, fileName), buffer, contentType);

    const manifest = await this.readManifest(userId);
    manifest.fonts.unshift(record);
    await this.writeManifest(userId, manifest);

    return record;
  }

  async renameFont(userId: string, fontId: string, displayName: string): Promise<CustomFontRecord> {
    const clean = (displayName || '').trim();
    if (!clean) {
      throw new HttpError(400, 'Font display name is required', 'INVALID_DISPLAY_NAME');
    }
    const manifest = await this.readManifest(userId);
    const font = manifest.fonts.find((f) => f.id === fontId);
    if (!font) {
      throw new HttpError(404, 'Font not found', 'FONT_NOT_FOUND');
    }
    font.displayName = clean.slice(0, 100);
    await this.writeManifest(userId, manifest);
    return font;
  }

  async deleteFont(userId: string, fontId: string): Promise<void> {
    const manifest = await this.readManifest(userId);
    const index = manifest.fonts.findIndex((f) => f.id === fontId);
    if (index === -1) {
      throw new HttpError(404, 'Font not found', 'FONT_NOT_FOUND');
    }
    const [removed] = manifest.fonts.splice(index, 1);
    await this.storage.deleteObject(this.fontObjectKey(userId, removed.id, removed.fileName));
    await this.writeManifest(userId, manifest);
  }

  async getFontBinary(
    userId: string,
    fontId: string
  ): Promise<{ body: Buffer; contentType: string; fileName: string }> {
    const manifest = await this.readManifest(userId);
    const font = manifest.fonts.find((f) => f.id === fontId);
    if (!font) {
      throw new HttpError(404, 'Font not found', 'FONT_NOT_FOUND');
    }
    const obj = await this.storage.getObject(this.fontObjectKey(userId, font.id, font.fileName));
    if (!obj) {
      throw new HttpError(404, 'Font binary missing from storage', 'FONT_BINARY_MISSING');
    }
    const contentType =
      font.format === 'otf' ? 'font/otf' : font.format === 'ttf' ? 'font/ttf' : 'font/collection';
    return {
      body: obj.body,
      contentType: obj.contentType || contentType,
      fileName: font.fileName,
    };
  }
}
