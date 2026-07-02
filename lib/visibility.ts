export function canViewComplaint(
  complaint: {
    visibility: 'PUBLIC' | 'ANONYMOUS' | 'PRIVATE'
    creatorId: string
  },
  requester: {
    userId: string
    role: 'OWNER' | 'EMPLOYEE'
  }
): boolean {
  if (complaint.visibility === 'PUBLIC' || complaint.visibility === 'ANONYMOUS') {
    return true
  }
  if (complaint.visibility === 'PRIVATE') {
    return requester.userId === complaint.creatorId || requester.role === 'OWNER'
  }
  return false
}

export function shapeComplaintForResponse<T extends { creatorId?: string; visibility: 'PUBLIC' | 'ANONYMOUS' | 'PRIVATE' }>(
  complaint: T,
  requester: {
    userId: string;
    role: 'OWNER' | 'EMPLOYEE';
  }
): Omit<T, 'creatorId'> & { creatorId?: string } {
  const copied = { ...complaint }
  if (
    complaint.visibility === 'ANONYMOUS' &&
    requester.role !== 'OWNER' &&
    requester.userId !== complaint.creatorId
  ) {
    delete copied.creatorId
  }
  return copied
}
