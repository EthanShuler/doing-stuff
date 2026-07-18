// The 63 US National Parks as a static in-repo list — deliberately no `parks`
// table (the set is fixed and public knowledge; only the *visits* live in the
// DB, keyed by `code`). Codes are the NPS's own park codes, so they're stable
// forever and double as the nps.gov URL slug. Coordinates are park centers,
// plenty for a national map. `region` drives the list view's grouping.

export const PARK_REGIONS = [
  'Alaska',
  'Pacific West',
  'Southwest',
  'Rocky Mountains',
  'Midwest & Plains',
  'East & South',
  'Islands & Territories',
] as const

export type ParkRegion = (typeof PARK_REGIONS)[number]

export interface Park {
  /** NPS park code — the stable id stored in `park_visits.park_code`. */
  code: string
  name: string
  /** State postal codes, slash-separated for multi-state parks ("WY/MT/ID"). */
  states: string
  region: ParkRegion
  lat: number
  lng: number
  /** Year it became a national park. */
  established: number
  /** One-line hook for the detail modal. */
  blurb: string
  npsUrl: string
}

const park = (
  code: string,
  name: string,
  states: string,
  region: ParkRegion,
  lat: number,
  lng: number,
  established: number,
  blurb: string,
  npsSlug = code,
): Park => ({ code, name, states, region, lat, lng, established, blurb, npsUrl: `https://www.nps.gov/${npsSlug}/` })

export const PARKS: Park[] = [
  // --- Alaska ---------------------------------------------------------------
  park('dena', 'Denali', 'AK', 'Alaska', 63.33, -150.5, 1917, 'Six million acres of wild land around North America’s tallest peak.'),
  park('gaar', 'Gates of the Arctic', 'AK', 'Alaska', 67.78, -153.3, 1980, 'The northernmost park — no roads, no trails, all Brooks Range.'),
  park('glba', 'Glacier Bay', 'AK', 'Alaska', 58.66, -136.9, 1980, 'Tidewater glaciers calving into a fjord-laced bay.'),
  park('katm', 'Katmai', 'AK', 'Alaska', 58.6, -155.06, 1980, 'Brown bears fishing the falls at Brooks Camp.'),
  park('kefj', 'Kenai Fjords', 'AK', 'Alaska', 59.92, -149.65, 1980, 'The Harding Icefield and the fjords its glaciers carved.'),
  park('kova', 'Kobuk Valley', 'AK', 'Alaska', 67.55, -159.28, 1980, 'Arctic sand dunes and half a million migrating caribou.'),
  park('lacl', 'Lake Clark', 'AK', 'Alaska', 60.97, -153.42, 1980, 'Steaming volcanoes, turquoise lakes, and salmon runs.'),
  park('wrst', 'Wrangell–St. Elias', 'AK', 'Alaska', 61.71, -142.99, 1980, 'The largest national park — bigger than Switzerland.'),

  // --- Pacific West ----------------------------------------------------------
  park('chis', 'Channel Islands', 'CA', 'Pacific West', 34.01, -119.42, 1980, 'Five wild islands off the Southern California coast.'),
  park('crla', 'Crater Lake', 'OR', 'Pacific West', 42.94, -122.11, 1902, 'The deepest lake in the US, impossibly blue in a volcano’s caldera.'),
  park('deva', 'Death Valley', 'CA/NV', 'Pacific West', 36.51, -116.93, 1994, 'The hottest, driest, lowest place in North America.'),
  park('jotr', 'Joshua Tree', 'CA', 'Pacific West', 33.87, -115.9, 1994, 'Twisted yuccas and boulder piles where two deserts meet.'),
  park('kica', 'Kings Canyon', 'CA', 'Pacific West', 36.89, -118.55, 1940, 'A glacier-carved canyon deeper than the Grand Canyon.', 'seki'),
  park('lavo', 'Lassen Volcanic', 'CA', 'Pacific West', 40.49, -121.51, 1916, 'Boiling mudpots and every type of volcano in one park.'),
  park('mora', 'Mount Rainier', 'WA', 'Pacific West', 46.85, -121.75, 1899, 'An icy stratovolcano ringed by wildflower meadows.'),
  park('noca', 'North Cascades', 'WA', 'Pacific West', 48.7, -121.2, 1968, 'The American Alps — over 300 glaciers and jagged peaks.'),
  park('olym', 'Olympic', 'WA', 'Pacific West', 47.8, -123.6, 1938, 'Rainforest, alpine ridges, and wild coast in one park.'),
  park('pinn', 'Pinnacles', 'CA', 'Pacific West', 36.49, -121.18, 2013, 'Volcanic spires, talus caves, and California condors.'),
  park('redw', 'Redwood', 'CA', 'Pacific West', 41.3, -124.0, 1968, 'The tallest trees on Earth along the foggy north coast.'),
  park('sequ', 'Sequoia', 'CA', 'Pacific West', 36.49, -118.57, 1890, 'Giant sequoias — including the largest tree on Earth.', 'seki'),
  park('yose', 'Yosemite', 'CA', 'Pacific West', 37.85, -119.55, 1890, 'Granite walls, waterfalls, and the valley that started it all.'),

  // --- Southwest --------------------------------------------------------------
  park('arch', 'Arches', 'UT', 'Southwest', 38.72, -109.57, 1971, 'Over 2,000 natural stone arches in red-rock desert.'),
  park('bibe', 'Big Bend', 'TX', 'Southwest', 29.25, -103.25, 1944, 'The Rio Grande’s big bend — desert, canyons, and dark skies.'),
  park('brca', 'Bryce Canyon', 'UT', 'Southwest', 37.59, -112.19, 1928, 'Amphitheaters crammed with orange hoodoo spires.'),
  park('cany', 'Canyonlands', 'UT', 'Southwest', 38.2, -109.93, 1964, 'A maze of canyons where the Green meets the Colorado.'),
  park('care', 'Capitol Reef', 'UT', 'Southwest', 38.37, -111.26, 1971, 'A hundred-mile wrinkle in the earth, plus pioneer orchards.'),
  park('cave', 'Carlsbad Caverns', 'NM', 'Southwest', 32.17, -104.44, 1930, 'Vast decorated caves and a nightly exodus of bats.'),
  park('grba', 'Great Basin', 'NV', 'Southwest', 39.01, -114.22, 1986, 'Ancient bristlecone pines under some of the darkest skies.'),
  park('grca', 'Grand Canyon', 'AZ', 'Southwest', 36.06, -112.14, 1919, 'A mile deep and two billion years of Earth laid bare.'),
  park('gumo', 'Guadalupe Mountains', 'TX', 'Southwest', 31.92, -104.87, 1972, 'Texas’s highest peaks on a fossilized Permian reef.'),
  park('pefo', 'Petrified Forest', 'AZ', 'Southwest', 35.07, -109.78, 1962, 'Rainbow badlands strewn with 200-million-year-old logs.'),
  park('sagu', 'Saguaro', 'AZ', 'Southwest', 32.25, -110.5, 1994, 'Forests of giant saguaro cactus flanking Tucson.'),
  park('whsa', 'White Sands', 'NM', 'Southwest', 32.78, -106.17, 2019, 'Blinding-white gypsum dunes — the world’s largest field.'),
  park('zion', 'Zion', 'UT', 'Southwest', 37.3, -113.05, 1919, 'Sheer sandstone canyons carved by the Virgin River.'),

  // --- Rocky Mountains ---------------------------------------------------------
  park('blca', 'Black Canyon of the Gunnison', 'CO', 'Rocky Mountains', 38.57, -107.72, 1999, 'A canyon so narrow and deep parts see minutes of sun a day.'),
  park('glac', 'Glacier', 'MT', 'Rocky Mountains', 48.7, -113.8, 1910, 'The Crown of the Continent and Going-to-the-Sun Road.'),
  park('grsa', 'Great Sand Dunes', 'CO', 'Rocky Mountains', 37.73, -105.51, 2004, 'North America’s tallest dunes against snowy peaks.'),
  park('grte', 'Grand Teton', 'WY', 'Rocky Mountains', 43.73, -110.8, 1929, 'The Tetons rising straight out of Jackson Hole.'),
  park('meve', 'Mesa Verde', 'CO', 'Rocky Mountains', 37.18, -108.49, 1906, 'Ancestral Puebloan cliff dwellings in canyon alcoves.'),
  park('romo', 'Rocky Mountain', 'CO', 'Rocky Mountains', 40.34, -105.68, 1915, 'Trail Ridge Road and tundra above 12,000 feet.'),
  park('yell', 'Yellowstone', 'WY/MT/ID', 'Rocky Mountains', 44.6, -110.5, 1872, 'The first national park — geysers, wolves, and bison.'),

  // --- Midwest & Plains ---------------------------------------------------------
  park('badl', 'Badlands', 'SD', 'Midwest & Plains', 43.75, -102.5, 1978, 'Striped buttes and fossil beds rising from the prairie.'),
  park('cuva', 'Cuyahoga Valley', 'OH', 'Midwest & Plains', 41.24, -81.55, 2000, 'A green ribbon of falls and towpath between Cleveland and Akron.'),
  park('indu', 'Indiana Dunes', 'IN', 'Midwest & Plains', 41.65, -87.05, 2019, 'Dunes and rare ecosystems on Lake Michigan’s south shore.'),
  park('isro', 'Isle Royale', 'MI', 'Midwest & Plains', 48.1, -88.55, 1940, 'A roadless Lake Superior island of moose and wolves.'),
  park('jeff', 'Gateway Arch', 'MO', 'Midwest & Plains', 38.63, -90.19, 2018, 'The 630-foot arch over the Mississippi in St. Louis.'),
  park('thro', 'Theodore Roosevelt', 'ND', 'Midwest & Plains', 46.97, -103.45, 1978, 'The badlands that shaped a conservationist president.'),
  park('voya', 'Voyageurs', 'MN', 'Midwest & Plains', 48.5, -92.88, 1975, 'A water-highway park of lakes, islands, and aurora.'),
  park('wica', 'Wind Cave', 'SD', 'Midwest & Plains', 43.57, -103.48, 1903, 'One of the longest caves on Earth beneath bison prairie.'),

  // --- East & South ---------------------------------------------------------------
  park('acad', 'Acadia', 'ME', 'East & South', 44.35, -68.21, 1919, 'Granite headlands where mountains meet the Atlantic.'),
  park('bisc', 'Biscayne', 'FL', 'East & South', 25.49, -80.21, 1980, 'A park that’s 95% water — reefs, keys, and shipwrecks.'),
  park('cong', 'Congaree', 'SC', 'East & South', 33.78, -80.78, 2003, 'The largest old-growth bottomland forest left in the Southeast.'),
  park('drto', 'Dry Tortugas', 'FL', 'East & South', 24.63, -82.87, 1992, 'A sea fortress and coral reefs 70 miles past Key West.'),
  park('ever', 'Everglades', 'FL', 'East & South', 25.32, -80.93, 1947, 'The river of grass — gators, manatees, and mangroves.'),
  park('grsm', 'Great Smoky Mountains', 'TN/NC', 'East & South', 35.68, -83.53, 1934, 'Misty ridges and the most-visited park in the country.'),
  park('hosp', 'Hot Springs', 'AR', 'East & South', 34.51, -93.05, 1921, 'Historic bathhouses fed by 143°F thermal springs.'),
  park('maca', 'Mammoth Cave', 'KY', 'East & South', 37.18, -86.1, 1941, 'The longest known cave system in the world.'),
  park('neri', 'New River Gorge', 'WV', 'East & South', 37.98, -81.05, 2020, 'The newest park — whitewater and cliffs under the famous bridge.'),
  park('shen', 'Shenandoah', 'VA', 'East & South', 38.53, -78.35, 1935, 'Skyline Drive along the Blue Ridge crest.'),

  // --- Islands & Territories --------------------------------------------------------
  park('hale', 'Haleakalā', 'HI', 'Islands & Territories', 20.72, -156.17, 1961, 'Sunrise above the clouds from a 10,000-foot crater.'),
  park('havo', 'Hawaiʻi Volcanoes', 'HI', 'Islands & Territories', 19.38, -155.2, 1916, 'Kīlauea and Mauna Loa — the planet actively being made.'),
  park('npsa', 'American Samoa', 'AS', 'Islands & Territories', -14.25, -170.68, 1988, 'Rainforest, reefs, and fruit bats in the South Pacific.'),
  park('viis', 'Virgin Islands', 'VI', 'Islands & Territories', 18.34, -64.73, 1956, 'Turquoise bays and hillside ruins on St. John.'),
]

/** Look up a park by its code; undefined for unknown/legacy codes. */
const byCode = new Map(PARKS.map((p) => [p.code, p]))
export function parkByCode(code: string): Park | undefined {
  return byCode.get(code)
}
