import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_DATA_FILE = "data/race_courses.json";

export function parseGpxPoints(gpx) {
  const points = [];
  const trackPointPattern = /<trkpt\b([^>]*)>/g;
  let match;

  while ((match = trackPointPattern.exec(gpx))) {
    const latitude = /\blat="([^"]+)"/.exec(match[1]);
    const longitude = /\blon="([^"]+)"/.exec(match[1]);
    if (!latitude || !longitude) continue;

    const point = [Number(latitude[1]), Number(longitude[1])];
    if (point.every(Number.isFinite)) points.push(point);
  }

  return points;
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

export async function generateRaceCourses({
  cwd = process.cwd(),
  dataFile = DEFAULT_DATA_FILE,
  log = console.log,
} = {}) {
  const racesDirectory = resolve(cwd, "content/races");
  const bundles = await readdir(racesDirectory, { withFileTypes: true });
  const courses = {};

  for (const bundle of bundles) {
    if (!bundle.isDirectory()) continue;

    const file = join(racesDirectory, bundle.name, "course.gpx");
    try {
      const path = buildRoutePath(parseGpxPoints(await readFile(file, "utf8")));
      if (path) courses[bundle.name] = path;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  await writeJsonAtomic(resolve(cwd, dataFile), courses);
  log(`Generated ${Object.keys(courses).length} race course paths.`);
  return courses;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateRaceCourses();
}
