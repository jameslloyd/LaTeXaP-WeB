export type FontFileFormat = 'ttf' | 'otf' | 'ttc';

export type LaTeXFontRole = 'main' | 'sans' | 'mono' | 'customFamily';

export interface CustomFontRecord {
  id: string;
  displayName: string;
  familyName: string;
  postScriptName: string;
  styleName: string;
  fileName: string;
  format: FontFileFormat;
  isMonospace: boolean;
  fileSizeBytes: number;
  addedAt: string;
}

export interface FontLibraryManifest {
  schemaVersion: number;
  fonts: CustomFontRecord[];
}

export interface CTANFontPreset {
  id: string;
  name: string;
  packageName: string;
  options: string;
  classification: string;
  description: string;
  usepackageStatement: string;
}
