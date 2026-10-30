const products = [
  [1, 'Royal parboiled rice', '10 kg', 94.90, 'staples'],
  [2, 'Siyabonga rice', '10 kg', 94.90, 'staples'],
  [3, 'Spekko rice, blue bag', '10 kg', 115.90, 'staples'],
  [4, 'Aunt Caroline rice', '10 kg', 124.90, 'staples'],
  [5, 'Unity cake wheat flour', '10 kg', 90.00, 'staples'],
  [6, 'Unity sugar', '10 kg', 170.00, 'staples'],
  [7, 'Royal brown sugar', '10 kg', 174.90, 'staples'],
  [8, "D'lite cooking oil", '5 L', 119.90, 'staples'],
  [9, 'SunPick cooking oil', '5 L', 139.90, 'staples'],
  [10, 'Sunseed cooking oil', '5 L', 144.90, 'staples'],
  [11, 'Sunfoil cooking oil', '5 L', 144.90, 'staples'],
  [12, 'NCP dry yeast', '500 g', 39.90, 'pantry'],
  [13, 'Everyday baked beans', '400 g', 9.90, 'pantry'],
  [14, 'Koo baked beans', '400 g', 12.90, 'pantry'],
  [15, 'Rhodes baked beans', '400 g', 9.90, 'pantry'],
  [16, 'Tomco baked beans', '400 g', 7.90, 'pantry'],
  [17, 'Lucky Star fish', '400 g', 23.90, 'pantry'],
  [18, 'Bokomo corn flakes', '1 kg', 38.90, 'pantry'],
  [19, 'Eezee noodles', '5 × 65 g', 29.90, 'pantry'],
  [20, "Glen tea bags", "26's", 9.90, 'pantry'],
  [21, 'Rainbow mixed portions', '4 kg', 164.90, 'fresh'],
  [22, 'Farmgate long life milk', '6 × 1 L', 69.90, 'fresh'],
  [23, 'Rama original', '250 g', 13.90, 'fresh'],
  [24, 'Rondo tub', '1 kg', 24.90, 'fresh'],
  [25, 'Stork tub', '1 kg', 39.90, 'fresh'],
  [26, 'Nestlé Cremora', '750 g', 49.90, 'fresh'],
  [27, 'Danone Ultra Mel custard', '1 L', 19.90, 'fresh'],
  [28, 'Oros juice', '5 L', 79.90, 'drinks'],
  [29, 'Fusion juice', '5 L', 39.90, 'drinks'],
  [30, 'Dalys juice', '1.5 L', 24.90, 'drinks'],
  [31, 'Coca-Cola', '2 L', 19.90, 'drinks'],
  [32, 'Reboost energy drink', '500 ml', 6.50, 'drinks'],
  [33, 'Maq washing powder', '3 × 1 kg', 59.90, 'home'],
  [34, 'Surf washing powder', '2 kg', 39.90, 'home'],
  [35, 'Nice One washing powder', '2 kg', 39.90, 'home'],
  [36, 'Jik bleach', '750 ml', 25.90, 'home'],
  [37, 'Twinsaver toilet rolls', "18's", 99.90, 'home'],
  [38, 'Daily laundry bar', '500 g', 26.90, 'home'],
  [39, 'Newden white candles', '450 g', 21.90, 'home'],
  [40, 'Lifebuoy soap', '175 g', 10.90, 'care'],
  [41, 'Santoor soap', '90 g', 7.90, 'care'],
  [42, 'Colgate maximum cavity', '2 × 100 ml', 33.90, 'care'],
  [43, 'Cuddlers jumbo nappies', 'jumbo pack', 129.90, 'care']
];

const combos = [
  [101, 'Zamukukhanya combo', 3820, 'c1', [
    '6 × 10 kg Siyabonga rice',
    '6 × 10 kg Royal brown sugar',
    '6 × 10 kg Sasko cake flour',
    '6 × 5 L Sunfoil cooking oil',
    '2 × 25 kg Mealie King',
    '2 × 5 kg Golden Penny sugar beans',
    '2 × 5 kg Itau samp'
  ]],
  [102, 'Zama Zama combo', 2720, 'c2', [
    '1 × 25 kg Mealie King maize meal',
    '4 × 10 kg Sasko cake flour',
    '4 × 10 kg Illovo sugar',
    '4 × 5 L Helios cooking oil',
    '4 × 10 kg Royal rice',
    '1 × 10 kg Golden Penny sugar beans',
    '1 × 10 kg Itau samp'
  ]],
  [103, 'Umzamo Wabafazi combo', 2685, 'c3', [
    '1 × 25 kg Itau maize meal',
    '4 × 10 kg Azam cake flour',
    '4 × 10 kg Royal or Illovo sugar',
    '4 × 5 L Sunseed cooking oil',
    '4 × 10 kg Siyabonga rice',
    '2 × 5 kg Royal sugar beans',
    '2 × 5 kg Itau samp'
  ]]
];

const categories = [
  ['combo', 'Stokvel combos', 1],
  ['staples', 'Rice, flour, sugar & oil', 2],
  ['pantry', 'Pantry', 3],
  ['fresh', 'Fresh & dairy', 4],
  ['drinks', 'Drinks', 5],
  ['home', 'Household', 6],
  ['care', 'Personal care', 7]
];

const blurbs = {
  staples: 'A kitchen staple at a bulk-saving price, packed for delivery from Siyabonga in Kranskop.',
  pantry: 'A pantry essential from our shelves, picked for your order.',
  fresh: 'Chilled and long-life dairy and meat, packed with care.',
  drinks: 'Cool drinks and juices, in family sizes.',
  home: 'Household and cleaning basics at a straight price.',
  care: 'Soap, toothpaste and nappies from the personal care aisle.',
  combo: 'A stokvel bulk combo. The price is for the whole pack list.'
};

module.exports = { products, combos, categories, blurbs };
