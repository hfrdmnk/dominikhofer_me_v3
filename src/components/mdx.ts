import Archive from "./Archive.astro";
import BookhiveReading from "./BookhiveReading.astro";
import DataNote from "./DataNote.astro";
import PersonalBestsList from "./PersonalBestsList.astro";
import Prose from "./Prose.astro";
import RaceList from "./RaceList.astro";
import SembleFinds from "./SembleFinds.astro";

/** Components available in the slash pages, which replace Hugo's shortcodes. */
export const mdxComponents = {
  Archive,
  BookhiveReading,
  DataNote,
  PersonalBestsList,
  Prose,
  RaceList,
  SembleFinds,
};
