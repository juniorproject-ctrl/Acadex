export const listingCategories = [
  'Textbooks',
  'Electronics',
  'Supplies',
  'Study Setup',
  'Lab Equipment',
  'Sports & Fitness',
  'Art & Design',
  'Musical Instruments',
  'Clothing & Accessories',
  'Home Essentials',
] as const;

export type ListingCategory = typeof listingCategories[number];
