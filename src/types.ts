export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: 'student' | 'admin';
  universityId: string;
}

export type Category = 'Textbooks' | 'Past Papers' | 'Study Groups' | 'Electronics' | 'Supplies' | 'Campus Events' | 'Others';

export interface Listing {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  price: number;
  category: Category;
  condition: 'New' | 'Like New' | 'Good' | 'Fair' | 'Poor';
  images: string[];
  location: string;
  deliveryOptions: ('Local Pickup' | 'Shipping Available')[];
  tags: string[];
  status: 'active' | 'sold' | 'draft';
  createdAt: any;
}

export interface CampusEvent {
  id: string;
  title: string;
  university: string;
  date: string;
  type: 'Social' | 'Career' | 'Workshop';
  image: string;
  description: string;
}

export interface PastPaper {
  id: string;
  title: string;
  department: string;
  downloads: number;
  universityId: string;
}

export interface StudyGroup {
  id: string;
  course: string;
  title: string;
  description: string;
  memberCount: number;
  universityId: string;
}
