export type Message = {
  message?: string;
  sanitizedMessage?: string;
  response?: string;
  intent?: {
    name?: string;
    description?: string;
  };
  id: string;
};
