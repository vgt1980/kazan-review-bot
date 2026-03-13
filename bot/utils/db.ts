import { db } from "@/lib/db";
import { User, Place, Review, ReviewPhoto, ReviewVote, Complaint, AdminUser, UserSession } from "@prisma/client";

// ==================== USER OPERATIONS ====================

export async function getUser(telegramId: string): Promise<User | null> {
  return db.user.findUnique({
    where: { telegramId },
  });
}

export async function getUserById(id: string): Promise<User | null> {
  return db.user.findUnique({
    where: { id },
  });
}

export async function createUser(data: {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}): Promise<User> {
  return db.user.create({
    data: {
      telegramId: data.telegramId,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
    },
  });
}

export async function updateUser(telegramId: string, data: Partial<User>): Promise<User> {
  return db.user.update({
    where: { telegramId },
    data,
  });
}

export async function updateUserStats(userId: string): Promise<void> {
  const reviews = await db.review.count({
    where: { userId, status: "approved" },
  });

  const status = getUserStatusByReviewCount(reviews);

  await db.user.update({
    where: { id: userId },
    data: {
      reviewCount: reviews,
      status,
    },
  });
}

function getUserStatusByReviewCount(count: number): string {
  if (count >= 50) return "top_reviewer";
  if (count >= 20) return "expert";
  if (count >= 5) return "active";
  return "novice";
}

export async function blockUser(userId: string, reason?: string): Promise<User> {
  return db.user.update({
    where: { id: userId },
    data: {
      isBlocked: true,
      blockedAt: new Date(),
      blockReason: reason,
    },
  });
}

export async function unblockUser(userId: string): Promise<User> {
  return db.user.update({
    where: { id: userId },
    data: {
      isBlocked: false,
      blockedAt: null,
      blockReason: null,
    },
  });
}

// ==================== ADMIN OPERATIONS ====================

export async function isAdmin(telegramId: string): Promise<boolean> {
  const admin = await db.adminUser.findFirst({
    where: {
      user: { telegramId },
    },
  });
  return !!admin;
}

export async function addAdmin(userId: string, addedBy?: string): Promise<AdminUser> {
  return db.adminUser.create({
    data: {
      userId,
      addedBy,
    },
  });
}

export async function removeAdmin(userId: string): Promise<void> {
  await db.adminUser.delete({
    where: { userId },
  });
}

export async function getAllAdmins(): Promise<(AdminUser & { user: User })[]> {
  return db.adminUser.findMany({
    include: { user: true },
  });
}

// ==================== PLACE OPERATIONS ====================

export async function getPlace(id: string): Promise<Place | null> {
  return db.place.findUnique({
    where: { id },
  });
}

export async function getPlaceByName(name: string, category?: string): Promise<Place | null> {
  return db.place.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(category && { category }),
    },
  });
}

export async function searchPlaces(query: string, options?: {
  category?: string;
  minRating?: number;
  hasPhotos?: boolean;
  limit?: number;
}): Promise<Place[]> {
  const { category, minRating, hasPhotos, limit = 10 } = options || {};

  return db.place.findMany({
    where: {
      name: { contains: query, mode: "insensitive" },
      ...(category && { category }),
      ...(minRating && { rating: { gte: minRating } }),
      reviewCount: { gte: hasPhotos ? 1 : 0 },
    },
    take: limit,
    orderBy: { rating: "desc" },
  });
}

export async function createPlace(data: {
  name: string;
  category: string;
  address?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
}): Promise<Place> {
  return db.place.create({
    data,
  });
}

export async function updatePlaceStats(placeId: string): Promise<void> {
  const reviews = await db.review.findMany({
    where: { placeId, status: "approved" },
    select: { overallRating: true },
  });

  if (reviews.length === 0) {
    await db.place.update({
      where: { id: placeId },
      data: { rating: 0, reviewCount: 0 },
    });
    return;
  }

  const avgRating = reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length;

  await db.place.update({
    where: { id: placeId },
    data: {
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
    },
  });
}

export async function getTopPlaces(limit: number = 10, minReviews: number = 3): Promise<Place[]> {
  return db.place.findMany({
    where: {
      reviewCount: { gte: minReviews },
    },
    take: limit,
    orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
  });
}

export async function getWorstPlaces(limit: number = 10, minReviews: number = 3): Promise<Place[]> {
  return db.place.findMany({
    where: {
      reviewCount: { gte: minReviews },
    },
    take: limit,
    orderBy: [{ rating: "asc" }, { reviewCount: "desc" }],
  });
}

export async function getNearbyPlaces(
  latitude: number,
  longitude: number,
  radiusKm: number = 2,
  limit: number = 10
): Promise<Place[]> {
  // Simple distance calculation using Haversine formula approximation
  // For production, consider using PostGIS or similar

  const places = await db.place.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
  });

  const nearbyPlaces = places
    .filter((p) => p.latitude && p.longitude)
    .map((p) => ({
      ...p,
      distance: calculateDistance(latitude, longitude, p.latitude!, p.longitude!),
    }))
    .filter((p) => p.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return nearbyPlaces;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ==================== REVIEW OPERATIONS ====================

export async function getReview(id: string): Promise<Review | null> {
  return db.review.findUnique({
    where: { id },
    include: {
      place: true,
      user: true,
      photos: true,
    },
  });
}

export async function getReviewsByPlace(placeId: string, options?: {
  limit?: number;
  offset?: number;
}): Promise<Review[]> {
  const { limit = 10, offset = 0 } = options || {};

  return db.review.findMany({
    where: { placeId, status: "approved" },
    include: {
      user: true,
      photos: true,
      _count: { select: { votes: true } },
    },
    take: limit,
    skip: offset,
    orderBy: { createdAt: "desc" },
  });
}

export async function getReviewsByUser(userId: string, options?: {
  limit?: number;
  offset?: number;
}): Promise<Review[]> {
  const { limit = 10, offset = 0 } = options || {};

  return db.review.findMany({
    where: { userId },
    include: {
      place: true,
      photos: true,
    },
    take: limit,
    skip: offset,
    orderBy: { createdAt: "desc" },
  });
}

export async function createReview(data: {
  placeId: string;
  userId: string;
  overallRating: number;
  foodRating?: number;
  serviceRating?: number;
  atmosphereRating?: number;
  valueRating?: number;
  text: string;
}): Promise<Review> {
  return db.review.create({
    data,
  });
}

export async function addReviewPhoto(reviewId: string, fileId: string, type: string = "place"): Promise<ReviewPhoto> {
  return db.reviewPhoto.create({
    data: {
      reviewId,
      fileId,
      type,
    },
  });
}

export async function hasUserReviewedPlace(userId: string, placeId: string): Promise<boolean> {
  const review = await db.review.findFirst({
    where: { userId, placeId },
  });
  return !!review;
}

export async function getPendingReviews(options?: {
  limit?: number;
  offset?: number;
}): Promise<Review[]> {
  const { limit = 10, offset = 0 } = options || {};

  return db.review.findMany({
    where: { status: "pending" },
    include: {
      place: true,
      user: true,
      photos: true,
    },
    take: limit,
    skip: offset,
    orderBy: { createdAt: "desc" },
  });
}

export async function approveReview(reviewId: string, adminId: string): Promise<Review> {
  return db.review.update({
    where: { id: reviewId },
    data: {
      status: "approved",
      moderatedBy: adminId,
      moderatedAt: new Date(),
    },
  });
}

export async function rejectReview(reviewId: string, adminId: string, reason?: string): Promise<Review> {
  return db.review.update({
    where: { id: reviewId },
    data: {
      status: "rejected",
      rejectionReason: reason,
      moderatedBy: adminId,
      moderatedAt: new Date(),
    },
  });
}

export async function countPendingReviews(): Promise<number> {
  return db.review.count({
    where: { status: "pending" },
  });
}

// ==================== VOTE OPERATIONS ====================

export async function getVote(reviewId: string, userId: string): Promise<ReviewVote | null> {
  return db.reviewVote.findUnique({
    where: { reviewId_userId: { reviewId, userId } },
  });
}

export async function createVote(reviewId: string, userId: string, voteType: string): Promise<ReviewVote> {
  return db.reviewVote.create({
    data: { reviewId, userId, voteType },
  });
}

export async function updateVote(reviewId: string, userId: string, voteType: string): Promise<ReviewVote> {
  return db.reviewVote.update({
    where: { reviewId_userId: { reviewId, userId } },
    data: { voteType },
  });
}

export async function deleteVote(reviewId: string, userId: string): Promise<void> {
  await db.reviewVote.delete({
    where: { reviewId_userId: { reviewId, userId } },
  });
}

export async function getVoteCounts(reviewId: string): Promise<{ up: number; down: number }> {
  const votes = await db.reviewVote.groupBy({
    by: ["voteType"],
    where: { reviewId },
    _count: true,
  });

  const up = votes.find((v) => v.voteType === "up")?._count || 0;
  const down = votes.find((v) => v.voteType === "down")?._count || 0;

  return { up, down };
}

// ==================== COMPLAINT OPERATIONS ====================

export async function createComplaint(data: {
  reviewId: string;
  userId: string;
  authorId: string;
  reason: string;
  description?: string;
}): Promise<Complaint> {
  return db.complaint.create({
    data,
  });
}

export async function getPendingComplaints(options?: {
  limit?: number;
  offset?: number;
}): Promise<Complaint[]> {
  const { limit = 10, offset = 0 } = options || {};

  return db.complaint.findMany({
    where: { status: "pending" },
    include: {
      review: {
        include: { place: true },
      },
      user: true,
      author: true,
    },
    take: limit,
    skip: offset,
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveComplaint(complaintId: string, adminId: string, status: string): Promise<Complaint> {
  return db.complaint.update({
    where: { id: complaintId },
    data: {
      status,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
  });
}

export async function countPendingComplaints(): Promise<number> {
  return db.complaint.count({
    where: { status: "pending" },
  });
}

// ==================== SESSION OPERATIONS ====================

export async function getDbSession(userId: string, sessionType: string): Promise<UserSession | null> {
  return db.userSession.findUnique({
    where: { userId_sessionType: { userId, sessionType } },
  });
}

export async function saveDbSession(userId: string, sessionType: string, data: object, step: number): Promise<UserSession> {
  return db.userSession.upsert({
    where: { userId_sessionType: { userId, sessionType } },
    update: {
      data: JSON.stringify(data),
      step,
      updatedAt: new Date(),
    },
    create: {
      userId,
      sessionType,
      data: JSON.stringify(data),
      step,
    },
  });
}

export async function clearDbSession(userId: string, sessionType: string): Promise<void> {
  await db.userSession.delete({
    where: { userId_sessionType: { userId, sessionType } },
  }).catch(() => {});
}

// ==================== SUBSCRIPTION OPERATIONS ====================

export async function getSubscriptions(userId: string): Promise<string[]> {
  const subs = await db.categorySubscription.findMany({
    where: { userId },
    select: { category: true },
  });
  return subs.map((s) => s.category);
}

export async function addSubscription(userId: string, category: string): Promise<void> {
  await db.categorySubscription.create({
    data: { userId, category },
  }).catch(() => {});
}

export async function removeSubscription(userId: string, category: string): Promise<void> {
  await db.categorySubscription.delete({
    where: { userId_category: { userId, category } },
  }).catch(() => {});
}

export async function getSubscribersByCategory(category: string): Promise<User[]> {
  const subs = await db.categorySubscription.findMany({
    where: { category },
    include: { user: true },
  });
  return subs.map((s) => s.user);
}

// ==================== STATISTICS ====================

export async function getStats(): Promise<{
  totalUsers: number;
  totalPlaces: number;
  totalReviews: number;
  pendingReviews: number;
  pendingComplaints: number;
  blockedUsers: number;
}> {
  const [totalUsers, totalPlaces, totalReviews, pendingReviews, pendingComplaints, blockedUsers] = await Promise.all([
    db.user.count(),
    db.place.count(),
    db.review.count({ where: { status: "approved" } }),
    db.review.count({ where: { status: "pending" } }),
    db.complaint.count({ where: { status: "pending" } }),
    db.user.count({ where: { isBlocked: true } }),
  ]);

  return {
    totalUsers,
    totalPlaces,
    totalReviews,
    pendingReviews,
    pendingComplaints,
    blockedUsers,
  };
}
