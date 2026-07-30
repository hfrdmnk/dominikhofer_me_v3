import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Decoder, Stream } from "@garmin/fitsdk";

const DEFAULT_DATA_FILE = "data/race_courses.json";
const SEMICIRCLES_TO_DEGREES = 180 / 2 ** 31;

export function decodeFitRecords(buffer) {
  const { messages, errors } = new Decoder(Stream.fromBuffer(buffer)).read();
  if (errors.length) {
    throw new Error(`FIT decode failed: ${errors.join(", ")}`);
  }

  return messages.recordMesgs ?? [];
}

function routePoints(records) {
  return records
    .filter(
      ({ positionLat, positionLong }) =>
        Number.isFinite(positionLat) && Number.isFinite(positionLong),
    )
    .map(({ positionLat, positionLong }) => [
      positionLat * SEMICIRCLES_TO_DEGREES,
      positionLong * SEMICIRCLES_TO_DEGREES,
    ]);
}

function percentileOpacities(values, maxOpacity) {
  const measured = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!measured.length) return [];

  const sorted = measured.toSorted((a, b) => a - b);
  if (sorted[0] === sorted.at(-1)) {
    return values.map((value) =>
      Number.isFinite(value) && value > 0 ? maxOpacity / 2 : 0,
    );
  }

  const ranks = new Map();
  for (let start = 0; start < sorted.length; ) {
    let end = start + 1;
    while (end < sorted.length && sorted[end] === sorted[start]) end += 1;
    const rank = ((start + end - 1) / 2) / (sorted.length - 1);
    ranks.set(sorted[start], rank);
    start = end;
  }

  return values.map((value) => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return ranks.get(value) * maxOpacity;
  });
}

function heartRateBuckets(records, count) {
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * records.length) / count);
    const end = Math.floor(((index + 1) * records.length) / count);
    const heartRates = records
      .slice(start, end)
      .map(({ heartRate }) => heartRate)
      .filter((heartRate) => Number.isFinite(heartRate) && heartRate > 0);

    if (!heartRates.length) return null;
    return heartRates.reduce((sum, heartRate) => sum + heartRate, 0) / heartRates.length;
  });
}

export function buildHeartRatePixels(records, count = 100, maxOpacity = 0.5) {
  if (!records.length) return [];

  const buckets = heartRateBuckets(records, count);

  return percentileOpacities(buckets, maxOpacity).map((opacity) =>
    Number(opacity.toFixed(3)),
  );
}

function phaseLengths(phases, totalPixels, minimumLength, maximumLength) {
  const elevations = phases.map((phase) => {
    const measured = phase
      .map(({ enhancedAltitude }) => enhancedAltitude)
      .filter(Number.isFinite);
    if (!measured.length) return null;
    return measured.reduce((sum, elevation) => sum + elevation, 0) / measured.length;
  });
  const measured = elevations.filter(Number.isFinite);
  if (measured.length !== phases.length) {
    return Array.from({ length: phases.length }, () => totalPixels / phases.length);
  }

  const minimum = Math.min(...measured);
  const maximum = Math.max(...measured);
  const range = maximum - minimum;
  if (!range) {
    return Array.from({ length: phases.length }, () => totalPixels / phases.length);
  }

  const mean = measured.reduce((sum, elevation) => sum + elevation, 0) / measured.length;
  const amplitude = Math.min(
    totalPixels / phases.length - minimumLength,
    maximumLength - totalPixels / phases.length,
  );
  const targets = measured.map(
    (elevation) => totalPixels / phases.length + ((elevation - mean) / range) * amplitude,
  );
  const lengths = targets.map(Math.floor);
  let remaining = totalPixels - lengths.reduce((sum, length) => sum + length, 0);
  const priority = targets
    .map((target, index) => ({ index, remainder: target - Math.floor(target) }))
    .toSorted((a, b) => b.remainder - a.remainder);

  for (let index = 0; remaining > 0; index = (index + 1) % priority.length) {
    const phase = priority[index].index;
    if (lengths[phase] >= maximumLength) continue;
    lengths[phase] += 1;
    remaining -= 1;
  }

  return lengths;
}

export function buildRacePhaseRows(
  records,
  rowCount = 10,
  totalPixels = 100,
  minimumLength = 7,
  maximumLength = 13,
  maxOpacity = 0.5,
) {
  if (!records.length || rowCount < 1 || totalPixels < rowCount) return [];

  const measuredDistances = records
    .map(({ distance }) => distance)
    .filter(Number.isFinite);
  const firstDistance = measuredDistances[0];
  const distanceRange = measuredDistances.at(-1) - firstDistance;
  const phases = Array.from({ length: rowCount }, () => []);

  records.forEach((record, index) => {
    const progress =
      distanceRange > 0 && Number.isFinite(record.distance)
        ? (record.distance - firstDistance) / distanceRange
        : index / Math.max(1, records.length - 1);
    const phase = Math.min(rowCount - 1, Math.max(0, Math.floor(progress * rowCount)));
    phases[phase].push(record);
  });

  const lengths = phaseLengths(phases, totalPixels, minimumLength, maximumLength);
  const buckets = phases.flatMap((phase, index) => heartRateBuckets(phase, lengths[index]));
  const opacities = percentileOpacities(buckets, maxOpacity).map((opacity) =>
    Number(opacity.toFixed(3)),
  );
  let offset = 0;

  return lengths.map((length) => {
    const row = opacities.slice(offset, offset + length);
    offset += length;
    return row;
  });
}

function squaredSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx || dy) {
    const progress = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (progress > 1) {
      x = end[0];
      y = end[1];
    } else if (progress > 0) {
      x += dx * progress;
      y += dy * progress;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplify(points, tolerance = 0.75) {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  const squaredTolerance = tolerance * tolerance;
  keep[0] = 1;
  keep[points.length - 1] = 1;

  while (stack.length) {
    const [startIndex, endIndex] = stack.pop();
    let furthestIndex = 0;
    let furthestDistance = squaredTolerance;

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = squaredSegmentDistance(
        points[index],
        points[startIndex],
        points[endIndex],
      );
      if (distance > furthestDistance) {
        furthestIndex = index;
        furthestDistance = distance;
      }
    }

    if (!furthestIndex) continue;
    keep[furthestIndex] = 1;
    stack.push([startIndex, furthestIndex], [furthestIndex, endIndex]);
  }

  return points.filter((_, index) => keep[index]);
}

function coordinate(value) {
  return Number(value.toFixed(1)).toString();
}

export function buildRoutePath(points, width = 640, height = 430, padding = 24) {
  if (points.length < 2) return "";

  const latitudes = points.map(([latitude]) => latitude);
  const longitudes = points.map(([, longitude]) => longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = maxLatitude - minLatitude;
  const longitudeRange = maxLongitude - minLongitude;
  if (!latitudeRange && !longitudeRange) return "";

  const scale = Math.min(
    longitudeRange ? (width - padding * 2) / longitudeRange : Infinity,
    latitudeRange ? (height - padding * 2) / latitudeRange : Infinity,
  );
  const routeWidth = longitudeRange * scale;
  const routeHeight = latitudeRange * scale;
  const offsetX = (width - routeWidth) / 2;
  const offsetY = (height - routeHeight) / 2;
  const projected = points.map(([latitude, longitude]) => [
    offsetX + (longitude - minLongitude) * scale,
    offsetY + (maxLatitude - latitude) * scale,
  ]);

  return simplify(projected)
    .map(
      ([x, y], index) =>
        `${index === 0 ? "M" : "L"}${coordinate(x)} ${coordinate(y)}`,
    )
    .join(" ");
}

async function writeJsonAtomic(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const temporaryFile = `${file}.${process.pid}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryFile, file);
}

export async function generateRaceArt({
  cwd = process.cwd(),
  dataFile = DEFAULT_DATA_FILE,
  log = console.log,
} = {}) {
  const racesDirectory = resolve(cwd, "content/races");
  const bundles = await readdir(racesDirectory, { withFileTypes: true });
  const raceArt = {};

  for (const bundle of bundles) {
    if (!bundle.isDirectory()) continue;

    const file = join(racesDirectory, bundle.name, "race.fit");
    try {
      const records = decodeFitRecords(await readFile(file));
      const points = routePoints(records);
      const route = buildRoutePath(points);
      const pixelRows = buildRacePhaseRows(records);
      if (route) {
        raceArt[bundle.name] = { route, pixelRows };
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  await writeJsonAtomic(resolve(cwd, dataFile), raceArt);
  log(`Generated artwork for ${Object.keys(raceArt).length} races.`);
  return raceArt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateRaceArt();
}
