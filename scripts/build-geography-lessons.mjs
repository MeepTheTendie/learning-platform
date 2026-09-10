// Generates the Geography Atlas guided lesson set into the shared lesson
// contract under content/lessons/geography/.
//
//   node scripts/build-geography-lessons.mjs

import fs from 'node:fs';
import path from 'node:path';
import { validateLesson } from '../packages/learning-content/index.mjs';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const outDir = path.join(root, 'content/lessons/geography');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const world = (slug, title, objective, opening, sections, activities, group) => ({ slug, title, objective, opening, sections, activities, group });

const LESSONS = [
  world('locate', 'Latitude and longitude', 'Use coordinates to locate places on Earth.', 'Every place on Earth can be located by two coordinates: how far north or south, and how far east or west.', [
    ['Parallels of latitude', 'Lines of latitude run east–west and measure distance north or south of the equator, from 0° at the equator to 90° at the poles. Because they are parallel, a degree of latitude covers roughly the same distance everywhere, about 111 km.'],
    ['Meridians of longitude', 'Lines of longitude run north–south between the poles and measure distance east or west of the prime meridian at 0°. They converge at the poles, so a degree of longitude covers less ground the farther you are from the equator.'],
    ['Writing a coordinate', 'Latitude is given first, then longitude — for example 30°N, 90°W. The equator and the prime meridian divide the globe into hemispheres.'],
  ], [
    { type: 'choice', prompt: 'Which lines run east–west and measure distance north or south of the equator?', choices: ['Lines of latitude', 'Lines of longitude', 'The prime meridian', 'The tropics'], answer: 0 },
    { type: 'choice', prompt: 'Lines of longitude all meet at…', choices: ['The equator', 'The poles', 'The prime meridian', 'The tropics'], answer: 1 },
    { type: 'choice', prompt: 'A place at 30°N, 90°W is closest to…', choices: ['New Orleans', 'London', 'Cairo', 'Sydney'], answer: 0 },
    { type: 'choice', prompt: 'Why does one degree of longitude cover less ground near the poles?', choices: ['Meridians converge at the poles', 'Latitude lines are farther apart', 'The equator is tilted', 'Earth spins faster there'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain why latitude alone cannot locate a place.', instructions: 'Two or three sentences are enough.', context: 'Latitude gives only north–south position. Many places share the same latitude, so a second coordinate is needed.', rubric: ['mentions east–west', 'explains that longitude is also needed'] },
  ], 'Map skills'),

  world('scale', 'Scale, projections, and map choices', 'Explain how scale and projection shape what a map shows.', 'A map is a set of choices. Scale sets how much ground a distance covers, and projection decides how a curved Earth is flattened.', [
    ['Scale', 'A large-scale map shows a small area in detail, such as a city plan. A small-scale map shows a large area with less detail, such as a world map. The fraction is the map distance divided by the ground distance.'],
    ['Projection', 'Flattening a sphere always distorts something: area, shape, distance, or direction. Mercator preserves direction but exaggerates high-latitude area; equal-area projections preserve size at the cost of shape.'],
    ['Choosing a map', 'The right map depends on the question. Navigation favors direction; comparing countries favors equal area; a city walk favors large scale.'],
  ], [
    { type: 'choice', prompt: 'A city plan is an example of…', choices: ['A large-scale map', 'A small-scale map', 'A thematic map', 'A projection'], answer: 0 },
    { type: 'choice', prompt: 'Every map projection distorts something because…', choices: ['A curved surface cannot be flattened without distortion', 'Maps are always out of date', 'Cartographers make mistakes', 'The equator is longer than the poles'], answer: 0 },
    { type: 'choice', prompt: 'The Mercator projection is best known for preserving…', choices: ['Direction', 'Area', 'Distance', 'Population'], answer: 0 },
    { type: 'choice', prompt: 'To compare the true area of two countries fairly, you should use…', choices: ['An equal-area projection', 'A Mercator map', 'Any map', 'A globe only'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain why there is no perfect map.', instructions: 'Two or three sentences.', context: 'Flattening a sphere forces a trade-off: preserving one property distorts another.', rubric: ['mentions distortion', 'names a property that is traded off'] },
  ], 'Map skills'),

  world('thematic', 'Reading thematic maps and data', 'Interpret maps that show data rather than just places.', 'Thematic maps show a pattern — population, rainfall, income — by encoding a value with color, size, or symbols.', [
    ['Common map types', 'A choropleth shades whole regions by value. An isoline connects points of equal value, like a contour or isobar. A dot map places one dot per count. Each answers a different question.'],
    ['Reading the legend', 'Always read the units, the class breaks, and the source. The same data can look dramatic or calm depending on how the breaks are chosen.'],
    ['A caution', 'Color and scale choices can mislead. A map is an argument about data, not the data itself.'],
  ], [
    { type: 'choice', prompt: 'A map that shades each country by population density is a…', choices: ['Choropleth map', 'Isoline map', 'Dot map', 'Topographic map'], answer: 0 },
    { type: 'choice', prompt: 'A line connecting points of equal temperature is called…', choices: ['An isoline (isotherm)', 'A contour of elevation', 'A choropleth', 'A scale bar'], answer: 0 },
    { type: 'choice', prompt: 'What should you check first when reading a thematic map?', choices: ['The legend, units, and source', 'The title font', 'The page number', 'The map colors only'], answer: 0 },
    { type: 'choice', prompt: 'Why can the same data look very different on two maps?', choices: ['Different class breaks and color choices', 'The data change', 'One map is wrong', 'The Earth changed'], answer: 0 },
    { type: 'short-answer', prompt: 'Describe one way a map can mislead even when the data are correct.', instructions: 'Two or three sentences.', context: 'Class breaks, color, and projection can all exaggerate or hide a pattern.', rubric: ['names a map choice', 'explains the misleading effect'] },
  ], 'Map skills'),

  world('tectonics', 'Earth’s structure and plate tectonics', 'Explain how moving plates shape the surface.', 'Earth’s outer shell is broken into plates that move slowly over the hot interior, building mountains, oceans, and volcanoes where they meet.', [
    ['Inside the Earth', 'A thin rocky crust sits on the mantle, with a dense metal core at the centre. Heat from the interior drives slow motion in the mantle.'],
    ['Three boundaries', 'At divergent boundaries plates pull apart and new crust forms. At convergent boundaries plates collide, lifting mountains or sinking into trenches. At transform boundaries they slide past each other, causing earthquakes.'],
    ['The Ring of Fire', 'Most of the world’s volcanoes and large earthquakes trace plate edges, especially around the Pacific.'],
  ], [
    { type: 'choice', prompt: 'New crust forms where plates…', choices: ['Pull apart', 'Collide', 'Slide past each other', 'Stop moving'], answer: 0 },
    { type: 'choice', prompt: 'Mountains such as the Himalayas form mainly at a…', choices: ['Convergent boundary', 'Divergent boundary', 'Transform boundary', 'Hot spot'], answer: 0 },
    { type: 'choice', prompt: 'Earthquakes at a transform boundary are caused by plates…', choices: ['Sliding past each other', 'Pulling apart', 'Melting', 'Growing'], answer: 0 },
    { type: 'choice', prompt: 'The Ring of Fire is a belt of…', choices: ['Volcanoes and earthquakes around the Pacific', 'Deserts', 'Rainforests', 'Ocean currents'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain how one type of plate boundary creates a landform.', instructions: 'Name the boundary and the feature.', context: 'Convergent, divergent, and transform boundaries each produce distinctive features.', rubric: ['names a boundary type', 'links it to a landform'] },
  ], 'Physical geography'),

  world('landforms', 'Landforms and erosion', 'Describe how water, ice, and wind shape the land.', 'Landscapes are built by uplift and carved by erosion. The shape of a valley or coast records which process did the work.', [
    ['Weathering and erosion', 'Weathering breaks rock in place; erosion carries the pieces away. Water, ice, wind, and gravity are the main movers.'],
    ['Rivers and coasts', 'Rivers cut valleys, carry sediment, and build deltas at their mouths. Waves erode headlands and deposit sand to form beaches and spits.'],
    ['Ice and wind', 'Glaciers carve U-shaped valleys and leave ridges of debris. Wind builds dunes in dry regions.'],
  ], [
    { type: 'choice', prompt: 'The difference between weathering and erosion is that erosion…', choices: ['Moves material away', 'Breaks rock in place', 'Only affects ice', 'Only happens in deserts'], answer: 0 },
    { type: 'choice', prompt: 'A delta forms where a river…', choices: ['Drops sediment at its mouth', 'Begins in the mountains', 'Flows fastest', 'Freezes'], answer: 0 },
    { type: 'choice', prompt: 'A U-shaped valley is most likely carved by…', choices: ['A glacier', 'Wind', 'A small stream', 'Waves'], answer: 0 },
    { type: 'choice', prompt: 'Sand dunes are mainly built by…', choices: ['Wind', 'Rivers', 'Glaciers', 'Volcanoes'], answer: 0 },
    { type: 'short-answer', prompt: 'Pick one landform and explain the process that created it.', instructions: 'Two or three sentences.', context: 'Water, ice, and wind each leave a recognizable signature on the land.', rubric: ['names a landform', 'names the process'] },
  ], 'Physical geography'),

  world('weather-climate', 'Weather and climate', 'Tell weather apart from climate and name the controls on each.', 'Weather is what the sky is doing now; climate is the long-run pattern of weather in a place.', [
    ['Two timescales', 'Weather changes hour to hour. Climate is the average and the range of conditions over decades. A cold week does not disprove a warming climate.'],
    ['Controls on climate', 'Latitude sets how much sunlight a place receives. Altitude cools the air. Distance from the sea moderates temperature. Ocean currents warm or cool coasts, and prevailing winds carry moisture or dryness.'],
    ['Oceans and climate', 'A warm current can keep a high-latitude port ice-free; a cold current can help create a coastal desert.'],
  ], [
    { type: 'choice', prompt: 'Climate is best described as…', choices: ['The long-run pattern of weather', 'Today’s temperature', 'Tomorrow’s forecast', 'A single storm'], answer: 0 },
    { type: 'choice', prompt: 'Which factor cools a place at high altitude?', choices: ['Altitude', 'Latitude', 'Longitude', 'Population'], answer: 0 },
    { type: 'choice', prompt: 'Why are coastal places often milder than inland places?', choices: ['The sea moderates temperature', 'They are closer to the equator', 'They get more wind', 'They are lower'], answer: 0 },
    { type: 'choice', prompt: 'A warm ocean current can…', choices: ['Keep a high-latitude coast ice-free', 'Freeze the coast', 'Cause a desert', 'Stop the tides'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain how one control on climate shapes a place you know.', instructions: 'Name the control and the effect.', context: 'Latitude, altitude, distance from the sea, currents, and winds all shape local climate.', rubric: ['names a control', 'explains its effect'] },
  ], 'Physical geography'),

  world('biomes', 'Climate zones and biomes', 'Match climate zones to the biomes they support.', 'Climate zones — tropical, dry, temperate, polar — support distinctive biomes, from rainforest to tundra.', [
    ['Climate zones', 'Tropical zones near the equator are warm year-round. Dry zones are hot and arid. Temperate zones have distinct seasons. Polar zones are cold with little precipitation.'],
    ['Biomes', 'A biome is a large community of plants and animals shaped by climate: rainforest, savanna, desert, grassland, temperate forest, taiga, and tundra.'],
    ['A rule of thumb', 'Temperature and rainfall together decide which biome a place can support.'],
  ], [
    { type: 'choice', prompt: 'A rainforest is most likely in which climate zone?', choices: ['Tropical', 'Polar', 'Dry', 'Temperate'], answer: 0 },
    { type: 'choice', prompt: 'The taiga is a…', choices: ['Cold forest of conifers', 'Hot desert', 'Tropical grassland', 'Ice sheet'], answer: 0 },
    { type: 'choice', prompt: 'Which two factors most decide a biome?', choices: ['Temperature and rainfall', 'Longitude and population', 'Soil color and wind', 'Latitude and country'], answer: 0 },
    { type: 'choice', prompt: 'Tundra is best described as…', choices: ['Cold and treeless', 'Hot and humid', 'Warm and wet', 'Dry and sandy'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain how climate decides which biome a region has.', instructions: 'Two or three sentences.', context: 'Temperature and rainfall together determine which plants and animals a region can support.', rubric: ['mentions temperature', 'mentions rainfall'] },
  ], 'Physical geography'),

  world('water', 'The water cycle and rivers', 'Trace water through the cycle and along a river.', 'Water moves endlessly between ocean, air, and land. Rivers are the visible part of that journey.', [
    ['The cycle', 'The Sun evaporates water; it condenses into clouds; precipitation falls; water runs off or soaks in; and it eventually returns to the ocean.'],
    ['A river’s course', 'A river begins at a source, gathers tributaries, flows through a watershed, and ends at a mouth, often building a delta.'],
    ['Why it matters', 'The water cycle supplies fresh water, shapes land, and links climate to rivers.'],
  ], [
    { type: 'choice', prompt: 'Water turning from liquid to vapour is…', choices: ['Evaporation', 'Condensation', 'Precipitation', 'Runoff'], answer: 0 },
    { type: 'choice', prompt: 'Vapour forming cloud droplets is…', choices: ['Condensation', 'Evaporation', 'Erosion', 'Infiltration'], answer: 0 },
    { type: 'choice', prompt: 'The area drained by a river system is its…', choices: ['Watershed', 'Delta', 'Source', 'Tributary'], answer: 0 },
    { type: 'choice', prompt: 'A tributary is…', choices: ['A smaller stream joining a larger one', 'A river’s mouth', 'A type of cloud', 'An ocean current'], answer: 0 },
    { type: 'short-answer', prompt: 'Describe one step of the water cycle in your own words.', instructions: 'Two or three sentences.', context: 'Evaporation, condensation, precipitation, runoff, and infiltration move water between ocean, air, and land.', rubric: ['names a step', 'explains what happens'] },
  ], 'Physical geography'),

  world('population', 'Population distribution and density', 'Distinguish distribution from density and explain where people live.', 'People are spread unevenly across the planet. Distribution is where they are; density is how many per area.', [
    ['Density versus distribution', 'Density divides population by area. Distribution describes the pattern — clustered, scattered, or along a coast or river.'],
    ['Where people live', 'People tend to live where climate is mild, water is available, soils are fertile, and jobs exist. Extreme cold, deserts, and high mountains are sparsely populated.'],
    ['The uneven map', 'Most of the world’s people live on a small share of the land, often near coasts and plains.'],
  ], [
    { type: 'choice', prompt: 'Population density is…', choices: ['People per unit of area', 'The total population', 'The number of cities', 'The birth rate'], answer: 0 },
    { type: 'choice', prompt: 'Which area is usually sparsely populated?', choices: ['A high, cold mountain range', 'A fertile river plain', 'A temperate coast', 'A coastal city'], answer: 0 },
    { type: 'choice', prompt: 'Distribution describes…', choices: ['Where people are located', 'How many people exist', 'How old people are', 'How fast a population grows'], answer: 0 },
    { type: 'choice', prompt: 'Which is a common reason people cluster near coasts?', choices: ['Trade, fishing, and milder climate', 'Higher mountains', 'Less water', 'Colder winters'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain why population is unevenly distributed.', instructions: 'Name two factors.', context: 'Climate, water, soil, relief, and jobs pull people toward some places and push them from others.', rubric: ['names two factors', 'links them to settlement'] },
  ], 'Human geography'),

  world('migration', 'Migration', 'Explain why people move and how to classify the movement.', 'Migration is the movement of people from one place to another. It is driven by pushes away from a place and pulls toward another.', [
    ['Push and pull', 'Pushes include conflict, drought, unemployment, and persecution. Pulls include work, safety, family, and freedom.'],
    ['Kinds of movement', 'Migration can be internal or international, voluntary or forced. A refugee flees across a border for safety; an economic migrant moves mainly for work.'],
    ['Consequences', 'Migration changes both the place left and the place settled, in population, culture, and economy.'],
  ], [
    { type: 'choice', prompt: 'A “pull” factor is something that…', choices: ['Attracts people to a place', 'Drives people away', 'Stops migration', 'Changes a border'], answer: 0 },
    { type: 'choice', prompt: 'A refugee is someone who…', choices: ['Flees across a border for safety', 'Moves for a higher salary', 'Travels for a holiday', 'Moves within a country for work'], answer: 0 },
    { type: 'choice', prompt: 'Migration within one country is called…', choices: ['Internal migration', 'International migration', 'Emigration', 'A diaspora'], answer: 0 },
    { type: 'choice', prompt: 'Which is a push factor?', choices: ['Drought and conflict', 'Better schools elsewhere', 'Higher wages elsewhere', 'Family already abroad'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain one push and one pull that could cause migration.', instructions: 'Two or three sentences.', context: 'Pushes drive people away; pulls draw them in. Real moves usually combine several.', rubric: ['names a push', 'names a pull'] },
  ], 'Human geography'),

  world('urbanization', 'Urbanization and cities', 'Explain why cities grow and how they are sited.', 'More than half the world’s people now live in cities, and the share keeps rising. Cities grow through migration and natural increase.', [
    ['Urbanization', 'Urbanization is the rising share of people living in towns and cities. It usually follows economic change as work shifts from farming to industry and services.'],
    ['Why cities sit where they do', 'A city’s site is its immediate setting, such as a river bend or harbour. Its situation is its position relative to the wider region, such as a crossroads of trade.'],
    ['Megacities', 'A megacity has more than ten million people. Many are now in Asia and the global South.'],
  ], [
    { type: 'choice', prompt: 'Urbanization means…', choices: ['A rising share of people living in cities', 'Building taller buildings', 'Closing farms', 'Building new roads'], answer: 0 },
    { type: 'choice', prompt: 'A city’s “site” refers to…', choices: ['Its immediate physical setting', 'Its position in the wider region', 'Its population rank', 'Its climate zone'], answer: 0 },
    { type: 'choice', prompt: 'A megacity has a population over…', choices: ['Ten million', 'One million', 'One hundred thousand', 'One billion'], answer: 0 },
    { type: 'choice', prompt: 'Cities often grow first at…', choices: ['River crossings and harbours', 'High mountain peaks', 'Deep deserts', 'Polar ice'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain one reason a city grows where it does.', instructions: 'Two or three sentences.', context: 'Site and situation explain why cities form at river crossings, harbours, and trade crossroads.', rubric: ['names a location factor', 'explains the advantage'] },
  ], 'Human geography'),

  world('culture', 'Culture regions, language, and religion', 'Describe how culture spreads and how regions are defined.', 'Culture is the shared way of life of a group: language, religion, food, and custom. Culture regions are areas that share these traits.', [
    ['Culture regions', 'A culture region is an area with shared cultural traits. Boundaries are usually fuzzy and overlap, unlike political borders.'],
    ['Language', 'Languages belong to families that share a common ancestor, such as the Romance languages descended from Latin. Languages spread by migration, trade, and empire.'],
    ['Diffusion', 'Cultural traits spread by relocation (people carry them) or expansion (they spread outward from a source).'],
  ], [
    { type: 'choice', prompt: 'A culture region is an area that shares…', choices: ['Cultural traits such as language and custom', 'A single government', 'One time zone', 'A common currency'], answer: 0 },
    { type: 'choice', prompt: 'Spanish, French, and Italian belong to which language family?', choices: ['Romance', 'Germanic', 'Slavic', 'Sino-Tibetan'], answer: 0 },
    { type: 'choice', prompt: 'Diffusion in which people carry a trait to a new place is…', choices: ['Relocation diffusion', 'Contagious diffusion', 'Stimulus diffusion', 'Hierarchical diffusion'], answer: 0 },
    { type: 'choice', prompt: 'Culture-region boundaries are usually…', choices: ['Fuzzy and overlapping', 'Exact straight lines', 'The same as borders', 'Permanent'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain how one cultural trait spreads between places.', instructions: 'Two or three sentences.', context: 'Relocation diffusion moves with people; expansion diffusion spreads outward from a source.', rubric: ['names a trait', 'names a diffusion type'] },
  ], 'Human geography'),

  world('agriculture', 'Agriculture and food systems', 'Connect climate, farming, and the food supply.', 'Farming feeds the world, and what can be grown where depends on climate, soil, and technology.', [
    ['Subsistence and commercial', 'Subsistence farming feeds the farmer’s family; commercial farming sells for profit, often on a large scale.'],
    ['Climate and crops', 'Warm, wet climates suit rice and tropical crops; temperate climates suit wheat, maize, and livestock.'],
    ['The Green Revolution', 'New seeds, fertiliser, and irrigation raised yields sharply in the twentieth century, with uneven costs and benefits.'],
  ], [
    { type: 'choice', prompt: 'Subsistence farming mainly…', choices: ['Feeds the farmer’s family', 'Sells for export', 'Uses no labour', 'Raises only livestock'], answer: 0 },
    { type: 'choice', prompt: 'Rice grows best in…', choices: ['Warm, wet climates', 'Cold, dry climates', 'Polar regions', 'High mountains'], answer: 0 },
    { type: 'choice', prompt: 'The Green Revolution mainly increased…', choices: ['Crop yields', 'Farm sizes', 'Rainfall', 'Imports'], answer: 0 },
    { type: 'choice', prompt: 'Which is a commercial farming crop?', choices: ['Wheat grown for export', 'A family vegetable plot', 'Foraged berries', 'A subsistence rice paddy'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain how climate limits what can be farmed in a region.', instructions: 'Two or three sentences.', context: 'Temperature, rainfall, and growing season decide which crops a region can support.', rubric: ['names a climate factor', 'links it to a crop'] },
  ], 'Human geography'),

  world('development', 'Resources, industry, and development', 'Compare measures of development and the role of resources.', 'Countries differ in wealth and well-being. Geographers measure development in more than one way.', [
    ['Resources', 'Renewable resources can be replenished, such as sunlight and wind. Non-renewable resources, such as coal and oil, are finite.'],
    ['Measures', 'GDP per person measures economic output. The Human Development Index adds health and education, giving a fuller picture.'],
    ['Industry and change', 'Industry often shifts from primary (farming, mining) to secondary (manufacturing) to tertiary (services) as economies develop.'],
  ], [
    { type: 'choice', prompt: 'Which is a renewable resource?', choices: ['Wind', 'Coal', 'Oil', 'Natural gas'], answer: 0 },
    { type: 'choice', prompt: 'The Human Development Index includes income, health, and…', choices: ['Education', 'Population', 'Area', 'Rainfall'], answer: 0 },
    { type: 'choice', prompt: 'GDP per person measures…', choices: ['Economic output per person', 'Average lifespan', 'Literacy', 'Land area'], answer: 0 },
    { type: 'choice', prompt: 'Manufacturing belongs to which economic sector?', choices: ['Secondary', 'Primary', 'Tertiary', 'Quaternary'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain why GDP alone can mislead about development.', instructions: 'Two or three sentences.', context: 'Income says nothing directly about health, education, or how evenly wealth is shared.', rubric: ['names a missing dimension', 'explains why it matters'] },
  ], 'Human geography'),

  world('continents', 'Continents and major physical features', 'Place the continents and their great physical features.', 'Seven continents hold the world’s great mountain ranges, deserts, and plains.', [
    ['The continents', 'Asia, Africa, North America, South America, Antarctica, Europe, and Australia. Asia is the largest; Australia the smallest inhabited continent.'],
    ['Great ranges and deserts', 'The Himalayas, Andes, and Rockies are young, high ranges. The Sahara and the Australian outback are vast dry regions.'],
    ['Rivers and plains', 'The Amazon, Nile, and Yangtze drain huge basins and support dense settlement.'],
  ], [
    { type: 'choice', prompt: 'Which is the largest continent?', choices: ['Asia', 'Africa', 'Europe', 'South America'], answer: 0 },
    { type: 'choice', prompt: 'The Andes are found in…', choices: ['South America', 'Asia', 'Africa', 'Europe'], answer: 0 },
    { type: 'choice', prompt: 'The Sahara is a…', choices: ['Desert in North Africa', 'Mountain range', 'River', 'Rainforest'], answer: 0 },
    { type: 'choice', prompt: 'The Nile flows mainly through…', choices: ['Africa', 'South America', 'Asia', 'Europe'], answer: 0 },
    { type: 'short-answer', prompt: 'Name one great physical feature and the continent it is on.', instructions: 'One or two sentences.', context: 'Continents hold distinctive mountain ranges, deserts, and river basins.', rubric: ['names a feature', 'names the continent'] },
  ], 'Regions'),

  world('oceans', 'Oceans, currents, and global connections', 'Explain the role of oceans and currents in a connected world.', 'Oceans cover most of the planet, move heat around it, and carry most of its trade.', [
    ['The oceans', 'Pacific, Atlantic, Indian, Southern, and Arctic. The Pacific is the largest and deepest.'],
    ['Currents and climate', 'Surface currents move warm water toward the poles and cold water toward the equator, moderating climate. The Gulf Stream warms western Europe.'],
    ['Global connections', 'Ships carry the bulk of world trade, and undersea cables carry the data. Oceans link economies as much as they separate coasts.'],
  ], [
    { type: 'choice', prompt: 'Which is the largest ocean?', choices: ['Pacific', 'Atlantic', 'Indian', 'Arctic'], answer: 0 },
    { type: 'choice', prompt: 'Ocean currents mainly move…', choices: ['Heat around the planet', 'Continents', 'Mountains', 'The Moon'], answer: 0 },
    { type: 'choice', prompt: 'The Gulf Stream helps keep which region mild?', choices: ['Western Europe', 'The Sahara', 'Antarctica', 'The Andes'], answer: 0 },
    { type: 'choice', prompt: 'Most world trade in goods travels by…', choices: ['Ship', 'Air', 'Rail only', 'Pipeline only'], answer: 0 },
    { type: 'short-answer', prompt: 'Explain how an ocean current can affect a coast’s climate.', instructions: 'Two or three sentences.', context: 'Warm currents raise coastal temperatures; cold currents can help create coastal deserts.', rubric: ['names a current direction or example', 'explains the climate effect'] },
  ], 'Regions'),
];

const index = [];
const GROUPS = ['Map skills', 'Physical geography', 'Human geography', 'Regions'];
for (const item of LESSONS) {
  const id = 'geography-' + item.slug;
  const activities = item.activities.map((activity, i) => ({ ...activity, id: `${id}-a${i}` }));
  activities.sort((a, b) => (a.type === 'short-answer' ? 1 : 0) - (b.type === 'short-answer' ? 1 : 0));
  const normalized = validateLesson({
    version: 1, id, subject: 'geography', title: item.title, objective: item.objective,
    lesson: { opening: item.opening, sections: item.sections.map(([heading, body]) => ({ heading, body })) },
    sources: ['World geography survey'],
    activities,
  });
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(normalized, null, 2) + '\n');
  index.push({ id, title: item.title, world: GROUPS.indexOf(item.group), worldTitle: item.group, objective: normalized.objective, boss: false });
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ version: 1, subject: 'geography', lessons: index }, null, 2) + '\n');
console.log(`Wrote ${index.length} Geography lessons to ${path.relative(root, outDir)}`);
