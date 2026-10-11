export type RecordIdentity = { id: number; clientId: string };

/** UI creation inputs cannot supply an existing record's identity. */
export type CreateRecordInput<Record extends RecordIdentity> = Omit<Record, keyof RecordIdentity> & {
  id?: never;
  clientId?: never;
};

/** The use case supplies the stable client ID before SQLite assigns its local ID. */
export type InsertRecordInput<Record extends RecordIdentity> = Omit<Record, 'id'> & { id?: never };

/** Updates identify an existing row; its client ID is loaded from SQLite. */
export type UpdateRecordInput<Record extends RecordIdentity> = Omit<Record, 'clientId'>;

export type StoredIdentity = { id?: number | null; clientId?: string | null };
type NullableOptionalFields<Record> = {
  [Field in keyof Record]: undefined extends Record[Field] ? Record[Field] | null : Record[Field];
};
export type StoredRow<Record extends RecordIdentity> = NullableOptionalFields<Omit<Record, keyof RecordIdentity>> &
  StoredIdentity;
