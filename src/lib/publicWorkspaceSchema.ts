import type { Database } from '@/integrations/supabase/types';

// Additive repository schema, available before hosted generated types catch up.
// This type does not create the table or relax its server-side permissions.
type PrivateJobs = Database['public']['Tables']['autosim_jobs'];
type PublicJobs = Omit<PrivateJobs, 'Relationships'> & {
  Relationships: [{
    foreignKeyName: 'public_jobs_parent_fk';
    columns: ['parent_job_id'];
    isOneToOne: false;
    referencedRelation: 'public_workspace_jobs';
    referencedColumns: ['id'];
  }];
};
export type PublicWorkspaceDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & { public_workspace_jobs: PublicJobs };
  };
};