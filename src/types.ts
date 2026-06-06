export interface Settings {
  targetEmail: string;
  notifyEnabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  githubLanguage: string;
  githubSort: 'stars' | 'updated';
  minStars: number;
  useSmtp: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  htmlUrl: string;
  updatedAt: string;
  aiSummary?: string;
}

export interface DigestLog {
  id: string;
  timestamp: string;
  success: boolean;
  recipient: string;
  deliveryMethod: 'simulated' | 'smtp';
  repositories: Repository[];
  emailSubject: string;
  emailBodyHtml: string;
  errorMessage?: string;
}
