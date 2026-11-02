// Shopping list: guesses the supermarket aisle from the item text (English and German).

/** [id, emoji, label, keywords]. A leading "=" matches a whole word only. */
export const AISLES: [string, string, string, string[]][] = [
	['veg', '🥦', 'Fruit & veg', ['apple', 'äpfel', 'apfel', 'banana', 'banane', 'orange', 'lemon', 'zitrone', 'lime', 'berr', 'beere', 'grape', 'traube', 'pear', 'birne', 'tomato', 'tomate', 'potato', 'kartoffel', 'onion', 'zwiebel', 'garlic', 'knoblauch', 'carrot', 'karotte', 'möhre', 'cucumber', 'gurke', 'salad', 'salat', 'lettuce', 'spinach', 'spinat', 'pepper', 'paprika', 'avocado', 'broccoli', 'brokkoli', 'courgette', 'zucchini', 'mushroom', 'pilz', 'champignon', 'herb', 'kräuter', 'basil', 'basilikum', 'ginger', 'ingwer', 'fruit', 'obst', 'veg', 'gemüse', 'mango', 'melon', 'kiwi', 'plum', 'pflaume']],
	['dairy', '🧀', 'Dairy & eggs', ['milk', 'milch', 'cheese', 'käse', 'yog', 'joghurt', 'jogurt', 'butter', 'cream', 'sahne', 'quark', '=egg', '=eggs', '=eier', 'mozzarella', 'feta', 'skyr', 'frischkäse']],
	['bakery', '🥖', 'Bakery', ['bread', 'brot', 'brötchen', '=rolls', 'toast', 'bagel', 'croissant', 'wrap', 'tortilla', 'pita', 'baguette']],
	['meat', '🍗', 'Meat & fish', ['chicken', 'hähnchen', 'huhn', 'beef', 'rind', 'mince', 'hack', 'sausage', 'wurst', 'würstchen', 'ham', 'schinken', 'bacon', 'speck', 'fish', 'fisch', 'salmon', 'lachs', 'tuna', 'thunfisch', 'salami', 'turkey', 'pute']],
	['frozen', '🧊', 'Frozen', ['frozen', 'tiefkühl', 'ice cream', '=eis', 'fish fingers', 'fischstäbchen', '=peas', 'erbsen', 'fries', 'pommes']],
	['pantry', '🥫', 'Cupboard', ['pasta', 'nudel', 'spaghetti', 'rice', 'reis', 'flour', 'mehl', 'sugar', 'zucker', '=oil', 'öl', 'olive', 'sauce', 'soße', 'sosse', '=tin', '=can', 'beans', 'bohnen', 'lentil', 'linsen', 'cereal', 'müsli', 'muesli', 'cornflakes', 'oats', 'hafer', 'honey', 'honig', 'jam', 'marmelade', 'nutella', 'peanut', 'erdnuss', 'spice', 'gewürz', '=salt', 'salz', 'coffee', 'kaffee', '=tea', 'tee', 'snack', 'chips', 'crisps', 'choc', 'schoko', 'biscuit', 'keks', 'cookie', '=nuts', 'nüsse', 'stock', 'brühe', 'vinegar', 'essig', 'ketchup', 'mayo', 'mustard', 'senf', 'popcorn', 'raisin', 'rosinen']],
	['drinks', '🥤', 'Drinks', ['juice', 'saft', 'water', 'wasser', 'sprudel', 'wine', 'wein', 'beer', 'bier', 'cola', 'lemonade', 'limo', 'squash', 'sirup', 'oat milk', 'hafermilch']],
	['home', '🧻', 'Household', ['loo', 'toilet', 'klopapier', 'kitchen roll', 'küchenrolle', 'tissue', 'taschentuch', 'soap', 'seife', 'shampoo', 'conditioner', 'toothpaste', 'zahnpasta', 'toothbrush', 'zahnbürste', 'detergent', 'waschmittel', 'spülmittel', 'washing up', 'dishwasher', 'spülmaschine', 'tabs', 'bin bag', 'müllbeutel', 'sponge', 'schwamm', 'nappies', 'windeln', 'foil', 'folie', 'batter', 'plaster', 'pflaster', 'deo', 'cleaner', 'reiniger', 'light bulb', 'glühbirne']]
];

export function aisleOf(text: string): string {
	const t = String(text).toLowerCase();
	const words = t.split(/[^a-zäöüß]+/).filter(Boolean);
	for (const a of AISLES)
		for (const k of a[3]) {
			if (k[0] === '=') {
				if (words.includes(k.slice(1))) return a[0];
			} else if (k.includes(' ')) {
				if (t.includes(k)) return a[0];
			} else if (words.some((w) => w.startsWith(k) || (k.length > 4 && w.includes(k)))) return a[0];
		}
	return 'other';
}

export const aisleInfo = (id: string): [string, string, string] => {
	const a = AISLES.find((x) => x[0] === id);
	return a ? [a[0], a[1], a[2]] : ['other', '🛒', 'Other'];
};
export const AISLE_ORDER = [...AISLES.map((a) => a[0]), 'other'];
