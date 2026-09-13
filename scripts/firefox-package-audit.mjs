import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
const EOCD_MIN_LENGTH = 22;
const ZIP_COMMENT_MAX_LENGTH = 0xffff;

const SENSITIVE_PATH_RE =
  /(^|\/)(?:\.env(?:$|\.)|\.dev\.vars(?:$|\.)|\.secrets?(?:$|[/.])|credentials?(?:$|[/.])|id_rsa(?:$|[/.])|password(?:$|[/.]))/i;

/** Return true for archive paths that are unsafe or can expose local secrets. */
export function isUnsafeArchivePath(value) {
  const name = String(value ?? '');
  return (
    name.length === 0 ||
    name.includes('\\') ||
    name.startsWith('/') ||
    /^[A-Za-z]:/.test(name) ||
    name.split('/').includes('..') ||
    SENSITIVE_PATH_RE.test(name)
  );
}

function fail(message) {
  throw new Error(`invalid ZIP archive: ${message}`);
}

function findEndOfCentralDirectory(buffer) {
  const signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const start = Math.max(0, buffer.length - EOCD_MIN_LENGTH - ZIP_COMMENT_MAX_LENGTH);
  const offset = buffer.lastIndexOf(signature);
  if (offset < start || offset < 0) fail('end of central directory is missing');
  if (offset + EOCD_MIN_LENGTH > buffer.length) fail('truncated end of central directory');
  return offset;
}

/** Read the central-directory metadata without invoking platform ZIP tools. */
export function readZipEntries(archivePath) {
  const buffer = readFileSync(archivePath);
  const eocd = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(eocd + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(eocd + 6);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocd + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocd + 16);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0) fail('multi-disk archives are not supported');
  if (centralDirectoryOffset + centralDirectorySize > buffer.length) {
    fail('central directory is truncated');
  }

  const entries = [];
  let cursor = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      fail(`central directory entry ${index} is invalid`);
    }
    const compression = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const end = nameStart + nameLength + extraLength + commentLength;
    if (end > buffer.length) fail(`central directory entry ${index} is truncated`);

    entries.push({
      name: buffer.subarray(nameStart, nameStart + nameLength).toString('utf8'),
      compression,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    cursor = end;
  }
  if (cursor > centralDirectoryOffset + centralDirectorySize) fail('central directory size is invalid');
  return { buffer, entries };
}

function readEntryBytes(archive, entry) {
  const { buffer } = archive;
  const offset = entry.localHeaderOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
    fail(`local header for ${entry.name} is invalid`);
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length) fail(`data for ${entry.name} is truncated`);
  const compressed = buffer.subarray(dataStart, dataEnd);
  let data;
  if (entry.compression === 0) {
    data = compressed;
  } else if (entry.compression === 8) {
    data = inflateRawSync(compressed);
  } else {
    fail(`unsupported compression method ${entry.compression} for ${entry.name}`);
  }
  if (data.length !== entry.uncompressedSize) fail(`size mismatch for ${entry.name}`);
  return data;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

/** Audit archive paths and, when supplied, the archive's embedded manifest. */
export function auditZipArchive(archivePath, expectedManifest) {
  const archive = readZipEntries(archivePath);
  const names = archive.entries.map((entry) => entry.name);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length > 0) fail(`duplicate entry ${duplicates[0]}`);
  const unsafe = names.filter(isUnsafeArchivePath);
  if (unsafe.length > 0) fail(`unsafe entry ${unsafe[0]}`);

  if (expectedManifest !== undefined) {
    const manifestEntry = archive.entries.find((entry) => entry.name === 'manifest.json');
    if (!manifestEntry) fail('manifest.json is missing');
    let archiveManifest;
    try {
      archiveManifest = JSON.parse(readEntryBytes(archive, manifestEntry).toString('utf8'));
    } catch (error) {
      fail(`manifest.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (JSON.stringify(canonicalize(archiveManifest)) !== JSON.stringify(canonicalize(expectedManifest))) {
      fail('archive manifest does not match the audited build manifest');
    }
  }

  return names;
}
