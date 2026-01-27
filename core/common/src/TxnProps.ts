import { Id64String } from "@itwin/core-bentley";

/**
 * @alpha
 * Transaction types
 */
export type TxnType = "Data" | "ECSchema" | "Ddl";

/**
 * @alpha
 * Represents the properties of a transaction within the transaction manager.
 *
 * @property id - The unique identifier for the transaction.
 * @property sessionId - The identifier of the session to which the transaction belongs.
 * @property nextId - (Optional) The identifier of the next transaction in the sequence.
 * @property prevId - (Optional) The identifier of the previous transaction in the sequence.
 * @property props - The arguments or properties associated with the save changes operation.
 * @property type - The type of transaction, which can be "Data", "ECSchema", or "Ddl".
 * @property reversed - Indicates whether the transaction has been reversed.
 * @property grouped - Indicates whether the transaction is grouped with others.
 * @property timestamp - The timestamp when the transaction was created.
 */
export interface TxnProps {
  id: Id64String;
  sessionId: number;
  nextId?: Id64String;
  prevId?: Id64String;
  props: SaveChangesArgs;
  type: TxnType;
  reversed: boolean;
  grouped: boolean;
  timestamp: string;
}

/**
 * Arguments for saving changes to the iModel.
 * @alpha
 */
export interface SaveChangesArgs {
  /**
   * Optional description of the changes being saved.
   */
  description?: string;
  /**
   * Optional source of the changes being saved.
   */
  source?: string;
  /**
   * Optional application-specific data to include with the changes.
   */
  appData?: { [key: string]: any };
}
