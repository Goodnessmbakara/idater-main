export class ProfileService {
  private requiredFields = [
    'interest',
    'gender',
    'dateOfBirth',
    'phone',
    'bio',
    'profileImage',
    'firstName',
    'lastName',
    'email',
    'about'
  ] as const;

  getProfileStatus(user: any) {
    const completedFields = this.requiredFields.filter(field => Boolean(user[field]));
    const missingFields = this.requiredFields.filter(field => !user[field]);
    
    return {
      completedProfile: missingFields.length === 0,
      profileCompletion: `${Math.round((completedFields.length / this.requiredFields.length) * 100)}%`,
      missingFields,
    };
  }
} 