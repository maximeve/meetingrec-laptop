export type RootStackParamList = {
  Record: undefined;
  Review: {
    audioUri: string;
    audioDuration: number;
    serverResult: any;
    savedActionablePoints?: Array<{
      id: string;
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      category: string;
      dueDate: string;
      assignee: string;
      status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
    }>;
  };
  History: undefined;
};
