export interface DmmItem {
  contentId: string;
  title: string;
  affiliateUrl: string;
  imageUrl: string;
  sampleImageUrl?: string;
  price: number;
  reviewCount: number;
  reviewAverage: number;
  category: "video" | "doujin" | "other";
  genres: string[];
  actresses: string[];
  fetchedAt: string;
}

export interface DlsiteItem {
  productId: string;
  title: string;
  affiliateUrl: string;
  imageUrl: string;
  price: number;
  reviewCount: number;
  reviewAverage: number;
  rankPosition: number;
  category: string;
  fetchedAt: string;
}
