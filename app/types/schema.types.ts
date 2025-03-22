export interface ColumnSchema {
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'unknown';
  sample?: any;
}