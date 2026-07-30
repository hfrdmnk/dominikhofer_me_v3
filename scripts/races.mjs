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

export function buildHeartRatePixels(records, count = 100, maxOpacity = 0.5) {
  if (!records.length) return [];

  const buckets = Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * records.length) / count);
    const end = Math.floor(((index + 1) * records.length) / count);
    const heartRates = records
      .slice(start, end)
      .map(({ heartRate }) => heartRate)
      .filter((heartRate) => Number.isFinite(heartRate) && heartRate > 0);

    if (!heartRates.length) return null;
    return heartRates.reduce((sum, heartRate) => sum + heartRate, 0) / heartRates.length;
  });
  const measured = buckets.filter(Number.isFinite);
  if (!measured.length) return [];

  const minimum = Math.min(...measured);
  const maximum = Math.max(...measured);
  const range = maximum - minimum;

  return buckets.map((heartRate) => {
    if (!Number.isFinite(heartRate)) return 0;
    if (!range) return maxOpacity;
    return Number((((heartRate - minimum) / range) * maxOpacity).toFixed(3));
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
      const route = buildRoutePath(routePoints(records));
      const pixels = buildHeartRatePixels(records);
      if (route) raceArt[bundle.name] = { route, pixels };
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
