export interface ApprovalClientSummary {
  id: string;
  name: string;
  totalPosts: number;
  pendingPosts: number;
  reviewPosts: number;
}

export interface ApprovalCalendarSummary {
  id: string;
  clientId: string;
  label: string;
  monthLabel: string;
  totalPosts: number;
  pendingPosts: number;
  approvedInternally: number;
  reviewPosts: number;
}
