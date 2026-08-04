import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_ARCHETYPES = [
  'title',
  'section',
  'text-only',
  'text-plus-image',
  'data',
  'diagram',
  'quotation',
];
const REQUIRED_SLOTS = {
  title: ['title', 'subtitle', 'media'],
  section: ['title', 'orientation'],
  'text-only': ['heading', 'body'],
  'text-plus-image': ['heading', 'body', 'media', 'caption'],
  data: ['heading', 'metrics', 'media', 'takeaway'],
  diagram: ['heading', 'media', 'caption'],
  quotation: ['quote', 'attribution', 'context'],
};
const REQUIRED_CAPACITY = {
  title: { titleLines: 3, subtitleLines: 2 },
  section: { titleLines: 3, orientationLines: 2 },
  'text-only': { headingLines: 2, bullets: 5, bulletLines: 2 },
  'text-plus-image': {
    headingLines: 2,
    bullets: 4,
    bulletLines: 2,
    captionLines: 2,
  },
  data: { headingLines: 2, charts: 1, metrics: 4, takeawayLines: 2 },
  diagram: { headingLines: 2, diagrams: 1, captionLines: 2 },
  quotation: { quoteLines: 4, attributionLines: 2, contextLines: 1 },
};
const SUPPORTED_PACKAGE_MAJOR = 1;

function invalidPackage(message, details = {}) {
  const error = new Error(message);
  error.code = 'INVALID_THEME_PACKAGE';
  Object.assign(error, details);
  throw error;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readJsonIfPresent(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function directoryHasEntries(directory) {
  try {
    return (await readdir(directory)).length > 0;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function fingerprint(filePath) {
  const contents = await readFile(filePath);
  return createHash('sha256').update(contents).digest('hex');
}

function declaredFiles(manifest) {
  const assets = manifest.assets.map(assetPath);
  return ['theme.json', manifest.css, ...assets];
}

function assetPath(asset) {
  const file = typeof asset === 'string' ? asset : asset?.path;
  if (
    typeof file !== 'string' ||
    !file ||
    path.isAbsolute(file) ||
    file.split(/[\\/]/).includes('..')
  ) {
    invalidPackage('Theme Manifest contains an invalid asset path.');
  }
  return file;
}

function validateCatalog(catalog) {
  if (!Number.isInteger(catalog.markupVersion) || catalog.markupVersion < 1) {
    invalidPackage('Theme Catalog has an invalid markup version.');
  }
  if (!Array.isArray(catalog.themes) || catalog.themes.length === 0) {
    invalidPackage('Theme Catalog has no Theme Packages.');
  }
  const ids = catalog.themes.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) {
    invalidPackage('Theme Catalog contains duplicate identifiers.');
  }
  if (!ids.includes(catalog.defaultTheme)) {
    invalidPackage('Theme Catalog default does not identify a listed package.');
  }
  for (const entry of catalog.themes) {
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id ?? '') || !entry.package) {
      invalidPackage('Theme Catalog contains an invalid package entry.');
    }
  }
}

async function validatePackage({ catalog, entry, packageDirectory }) {
  let manifest;
  try {
    manifest = await readJson(path.join(packageDirectory, 'theme.json'));
  } catch {
    invalidPackage(`Theme "${entry.id}" is missing a readable Theme Manifest.`);
  }

  if (manifest.id !== entry.id) {
    invalidPackage(
      `Theme Catalog identifier "${entry.id}" does not match manifest identifier "${manifest.id}".`,
    );
  }

  for (const field of ['name', 'description', 'marpTheme', 'css']) {
    if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
      invalidPackage(`Theme "${entry.id}" has an invalid "${field}" field.`);
    }
  }
  if (manifest.marpTheme !== manifest.id) {
    invalidPackage(`Theme "${entry.id}" has mismatched Marp theme identity.`);
  }

  if (manifest.markupVersion !== catalog.markupVersion) {
    invalidPackage(
      `Theme "${entry.id}" uses markup version ${manifest.markupVersion}; supported version is ${catalog.markupVersion}.`,
    );
  }

  if (!/^\d+\.\d+\.\d+$/.test(manifest.packageVersion ?? '')) {
    invalidPackage(`Theme "${entry.id}" has an invalid package version.`);
  }
  if (Number.parseInt(manifest.packageVersion, 10) !== SUPPORTED_PACKAGE_MAJOR) {
    invalidPackage(
      `Theme "${entry.id}" uses unsupported package version ${manifest.packageVersion}.`,
    );
  }

  for (const role of ['display', 'body', 'label']) {
    if (
      !Array.isArray(manifest.fonts?.[role]) ||
      manifest.fonts[role].length === 0 ||
      manifest.fonts[role].some((family) => typeof family !== 'string' || !family)
    ) {
      invalidPackage(`Theme "${entry.id}" has an invalid ${role} font stack.`);
    }
  }
  if (typeof manifest.fonts?.genericFallback !== 'string') {
    invalidPackage(`Theme "${entry.id}" has no generic font fallback.`);
  }
  if (
    !manifest.palette ||
    Object.values(manifest.palette).length === 0 ||
    Object.values(manifest.palette).some(
      (color) => typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color),
    )
  ) {
    invalidPackage(`Theme "${entry.id}" has an invalid palette.`);
  }
  if (
    typeof manifest.media?.pictureTreatment !== 'string' ||
    !manifest.media.pictureTreatment ||
    typeof manifest.media?.diagramTreatment !== 'string' ||
    !manifest.media.diagramTreatment
  ) {
    invalidPackage(`Theme "${entry.id}" has incomplete media treatments.`);
  }
  if (!Array.isArray(manifest.assets)) {
    invalidPackage(`Theme "${entry.id}" assets must be an array.`);
  }

  for (const archetype of REQUIRED_ARCHETYPES) {
    const definition = manifest.archetypes?.[archetype];
    if (
      !definition?.class ||
      !definition?.tone ||
      !definition?.capacity ||
      !definition?.variations?.length
    ) {
      invalidPackage(`Theme "${entry.id}" has an incomplete "${archetype}" archetype.`);
    }
    if (JSON.stringify(definition.slots) !== JSON.stringify(REQUIRED_SLOTS[archetype])) {
      invalidPackage(`Theme "${entry.id}" has invalid "${archetype}" Content Slots.`);
    }
    const requiredCapacity = REQUIRED_CAPACITY[archetype];
    if (
      JSON.stringify(Object.keys(definition.capacity).sort()) !==
        JSON.stringify(Object.keys(requiredCapacity).sort()) ||
      Object.entries(requiredCapacity).some(
        ([measure, minimum]) =>
          !Number.isInteger(definition.capacity[measure]) ||
          definition.capacity[measure] < minimum,
      )
    ) {
      invalidPackage(`Theme "${entry.id}" has invalid "${archetype}" capacity.`);
    }
    for (const variation of definition.variations) {
      if (!variation.id || !variation.class || !variation.when) {
        invalidPackage(`Theme "${entry.id}" has an incomplete "${archetype}" variation.`);
      }
    }
  }

  const textPlusImage = manifest.archetypes['text-plus-image'];
  const variations = new Set(textPlusImage.variations.map((variation) => variation.id));
  if (!variations.has('portrait') || !variations.has('landscape')) {
    invalidPackage(
      `Theme "${entry.id}" must define portrait and landscape text-plus-image variations.`,
    );
  }

  let css;
  try {
    css = await readFile(path.join(packageDirectory, manifest.css), 'utf8');
  } catch {
    invalidPackage(
      `Theme "${entry.id}" is missing its declared stylesheet "${manifest.css}".`,
    );
  }

  if (!new RegExp(`@theme\\s+${entry.id}(?:\\s|\\*/)`).test(css)) {
    invalidPackage(
      `Theme "${entry.id}" stylesheet does not declare matching @theme metadata.`,
    );
  }

  for (const archetype of REQUIRED_ARCHETYPES) {
    const selector = `section.${manifest.archetypes[archetype].class}`;
    if (!css.includes(selector)) {
      invalidPackage(
        `Theme "${entry.id}" stylesheet does not implement declared archetype selector "${selector}".`,
      );
    }
    for (const slot of manifest.archetypes[archetype].slots) {
      if (!css.includes(`.slot-${slot}`)) {
        invalidPackage(
          `Theme "${entry.id}" stylesheet does not implement Content Slot ".slot-${slot}".`,
        );
      }
    }
    if (!css.includes(`.${manifest.archetypes[archetype].tone}`)) {
      invalidPackage(
        `Theme "${entry.id}" stylesheet does not declare tone class ".${manifest.archetypes[archetype].tone}".`,
      );
    }
    for (const variation of manifest.archetypes[archetype].variations) {
      if (!css.includes(`.${variation.class}`)) {
        invalidPackage(
          `Theme "${entry.id}" stylesheet does not declare variation class ".${variation.class}".`,
        );
      }
    }
  }

  for (const file of declaredFiles(manifest)) {
    try {
      await readFile(path.join(packageDirectory, file));
    } catch {
      invalidPackage(`Theme "${entry.id}" is missing declared file "${file}".`);
    }
  }

  return manifest;
}

async function validateLock({ lock, packageDirectory, manifest }) {
  if (
    lock.packageVersion !== manifest.packageVersion ||
    lock.markupVersion !== manifest.markupVersion
  ) {
    invalidPackage(`Locked Theme Package "${lock.id}" has inconsistent version metadata.`);
  }

  for (const file of declaredFiles(manifest)) {
    const expected = lock.files?.[file];
    const actual = await fingerprint(path.join(packageDirectory, file));
    if (!expected || expected !== actual) {
      invalidPackage(`Locked Theme Package "${lock.id}" has a modified file: ${file}.`);
    }
  }
}

function isNewerVersion(candidate, current) {
  const toParts = (version) => version.split('.').map(Number);
  const candidateParts = toParts(candidate);
  const currentParts = toParts(current);
  for (let index = 0; index < candidateParts.length; index += 1) {
    if (candidateParts[index] === currentParts[index]) continue;
    return candidateParts[index] > currentParts[index];
  }
  return false;
}

export async function resolveTheme({
  discovery,
  themesDirectory,
  projectThemesDirectory,
}) {
  const catalog = await readJson(path.join(themesDirectory, 'catalog.json'));
  validateCatalog(catalog);
  const requestedId = discovery.theme?.id;
  const id = requestedId ?? catalog.defaultTheme;
  const entry = catalog.themes.find((theme) => theme.id === id);

  if (!entry) {
    const supportedIds = catalog.themes.map((theme) => theme.id);
    const error = new Error(
      `Unknown Presentation Theme "${id}". Choose one of: ${supportedIds.join(', ')}.`,
    );
    error.code = 'UNKNOWN_THEME';
    error.supportedIds = supportedIds;
    throw error;
  }

  const installedPackageDirectory = path.join(themesDirectory, entry.package);
  const installedManifest = await validatePackage({
    catalog,
    entry,
    packageDirectory: installedPackageDirectory,
  });

  if (projectThemesDirectory) {
    const lockPath = path.join(projectThemesDirectory, 'theme-lock.json');
    const lock = await readJsonIfPresent(lockPath);
    if (!lock && (await directoryHasEntries(projectThemesDirectory))) {
      invalidPackage(
        'Project Theme snapshot exists without a readable theme-lock.json.',
      );
    }
    if (
      lock &&
      (!lock.id ||
        !lock.packageVersion ||
        !Number.isInteger(lock.markupVersion) ||
        !lock.files ||
        typeof lock.files !== 'object')
    ) {
      invalidPackage('Project Theme snapshot has an incomplete theme-lock.json.');
    }
    if (lock?.id === id) {
      const packageDirectory = path.join(projectThemesDirectory, id);
      const manifest = await validatePackage({ catalog, entry, packageDirectory });
      await validateLock({ lock, packageDirectory, manifest });
      return {
        id,
        manifest,
        packageDirectory,
        source: 'project-snapshot',
        updateAvailable: isNewerVersion(
          installedManifest.packageVersion,
          manifest.packageVersion,
        ),
        usedLegacyFallback: requestedId === undefined,
      };
    }
  }

  return {
    id,
    manifest: installedManifest,
    packageDirectory: installedPackageDirectory,
    source: 'installed-package',
    updateAvailable: false,
    usedLegacyFallback: requestedId === undefined,
  };
}

export async function snapshotTheme({ resolution, projectThemesDirectory }) {
  const destination = path.join(projectThemesDirectory, resolution.id);
  await rm(projectThemesDirectory, { recursive: true, force: true });
  await mkdir(projectThemesDirectory, { recursive: true });
  await cp(resolution.packageDirectory, destination, { recursive: true });

  const files = {};
  for (const file of declaredFiles(resolution.manifest)) {
    files[file] = await fingerprint(path.join(destination, file));
  }

  const lock = {
    lockVersion: 1,
    id: resolution.id,
    packageVersion: resolution.manifest.packageVersion,
    markupVersion: resolution.manifest.markupVersion,
    files,
  };
  await writeFile(
    path.join(projectThemesDirectory, 'theme-lock.json'),
    `${JSON.stringify(lock, null, 2)}\n`,
  );
  return lock;
}
