import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { BentleyPromise, BentleyReturn } from "@bentley/bentleyjs-core/lib/Bentley";
import { loadNodeAddon } from "./addonLoader";
import { MultiTierExecutionHost, RunsIn, Tier } from "@bentley/bentleyjs-core/lib/tiering";

const dgnDbNodeAddon = loadNodeAddon();

export const enum DgnDbStatus {
    DGNDB_ERROR_BASE = 0x10000,
    Success = 0,
    AlreadyLoaded = DGNDB_ERROR_BASE + 1,
    AlreadyOpen = DGNDB_ERROR_BASE + 2,
    BadArg = DGNDB_ERROR_BASE + 3,
    BadElement = DGNDB_ERROR_BASE + 4,
    BadModel = DGNDB_ERROR_BASE + 5,
    BadRequest = DGNDB_ERROR_BASE + 6,
    BadSchema = DGNDB_ERROR_BASE + 7,
    CannotUndo = DGNDB_ERROR_BASE + 8,
    CodeNotReserved = DGNDB_ERROR_BASE + 9,
    DeletionProhibited = DGNDB_ERROR_BASE + 10,
    DuplicateCode = DGNDB_ERROR_BASE + 11,
    DuplicateName = DGNDB_ERROR_BASE + 12,
    ElementBlockedChange = DGNDB_ERROR_BASE + 13,
    FileAlreadyExists = DGNDB_ERROR_BASE + 14,
    FileNotFound = DGNDB_ERROR_BASE + 15,
    FileNotLoaded = DGNDB_ERROR_BASE + 16,
    ForeignKeyConstraint = DGNDB_ERROR_BASE + 17,
    IdExists = DGNDB_ERROR_BASE + 18,
    InDynamicTransaction = DGNDB_ERROR_BASE + 19,
    InvalidCategory = DGNDB_ERROR_BASE + 20,
    InvalidCode = DGNDB_ERROR_BASE + 21,
    InvalidCodeSpec = DGNDB_ERROR_BASE + 22,
    InvalidId = DGNDB_ERROR_BASE + 23,
    InvalidName = DGNDB_ERROR_BASE + 24,
    InvalidParent = DGNDB_ERROR_BASE + 25,
    InvalidProfileVersion = DGNDB_ERROR_BASE + 26,
    IsCreatingRevision = DGNDB_ERROR_BASE + 27,
    LockNotHeld = DGNDB_ERROR_BASE + 28,
    Mismatch2d3d = DGNDB_ERROR_BASE + 29,
    MismatchGcs = DGNDB_ERROR_BASE + 30,  // The Geographic Coordinate Systems of the source and target are not based on equivalent projections
    MissingDomain = DGNDB_ERROR_BASE + 31,
    MissingHandler = DGNDB_ERROR_BASE + 32,
    MissingId = DGNDB_ERROR_BASE + 33,
    NoGeometry = DGNDB_ERROR_BASE + 34,
    NoMultiTxnOperation = DGNDB_ERROR_BASE + 35,
    NotDgnMarkupProject = DGNDB_ERROR_BASE + 36,
    NotEnabled = DGNDB_ERROR_BASE + 37,
    NotFound = DGNDB_ERROR_BASE + 38,
    NotOpen = DGNDB_ERROR_BASE + 39,
    NotOpenForWrite = DGNDB_ERROR_BASE + 40,
    NotSameUnitBase = DGNDB_ERROR_BASE + 41,
    NothingToRedo = DGNDB_ERROR_BASE + 42,
    NothingToUndo = DGNDB_ERROR_BASE + 43,
    ParentBlockedChange = DGNDB_ERROR_BASE + 44,
    ReadError = DGNDB_ERROR_BASE + 45,
    ReadOnly = DGNDB_ERROR_BASE + 46,
    ReadOnlyDomain = DGNDB_ERROR_BASE + 47,
    RepositoryManagerError = DGNDB_ERROR_BASE + 48,
    SQLiteError = DGNDB_ERROR_BASE + 49,
    TransactionActive = DGNDB_ERROR_BASE + 50,
    UnitsMissing = DGNDB_ERROR_BASE + 51,
    UnknownFormat = DGNDB_ERROR_BASE + 52,
    UpgradeFailed = DGNDB_ERROR_BASE + 53,
    ValidationFailed = DGNDB_ERROR_BASE + 54,
    VersionTooNew = DGNDB_ERROR_BASE + 55,
    VersionTooOld = DGNDB_ERROR_BASE + 56,
    ViewNotFound = DGNDB_ERROR_BASE + 57,
    WriteError = DGNDB_ERROR_BASE + 58,
    WrongClass = DGNDB_ERROR_BASE + 59,
    WrongDgnDb = DGNDB_ERROR_BASE + 60,
    WrongDomain = DGNDB_ERROR_BASE + 61,
    WrongElement = DGNDB_ERROR_BASE + 62,
    WrongHandler = DGNDB_ERROR_BASE + 63,
    WrongModel = DGNDB_ERROR_BASE + 64,
}

/** A token that identifies a DgnDb */
export class DgnDbToken {
    constructor(public id: string) { }
}

/** The gateway to the native DgnPlatform methods pertaining to a DgnDb. All of these methods are services-tier-only.
 * -- All methods in this class must be static.
 * -- All public methods must have the @RunsIn(Tier.Services) decorator.
 */
@MultiTierExecutionHost("@bentley/imodeljs-dgnplatform")
export class DgnDb {

    private static dbs = new Map<string, any>();    // services tier only

    private static getReturnError<StatusType, ResType>(s: StatusType, m: string): BentleyReturn<StatusType, ResType> {
        return { error: { status: s, message: m } };
    }

    private static getPromiseError<StatusType, ResType>(s: StatusType, m: string): BentleyPromise<StatusType, ResType> {
        return Promise.resolve(DgnDb.getReturnError(s, m));
    }

    // *** NEEDS WORK: What is the correct DbResult for "the db is not open"?
    private static getNotOpenDbResultPromise<ResType>(): BentleyPromise<DbResult, ResType> {
        return Promise.resolve(DgnDb.getReturnError(DbResult.BE_SQLITE_CANTOPEN, ""));
    }

    /**
     * Open the Db.
     * @param fileName  The name of the db file.
     * @param mode      The open mode
     * @return Promise that resolves to an object that contains an error property if the operation failed
     *          or the "token" that identifies the Db on the server if success.
     */
    @RunsIn(Tier.Services)
    public static callOpenDb(fileName: string, mode: OpenMode): BentleyPromise<DbResult, DgnDbToken> {
        let dgndb = DgnDb.dbs.get(fileName);
        if (undefined !== dgndb)    // If the file is already open, just acknowledge that
            return Promise.resolve({ result: new DgnDbToken(fileName) }); // for now, we just use the fileName as the "token" that identifies the Db
        return new Promise((resolve, _reject) => {
            dgndb = new dgnDbNodeAddon.DgnDb();
            dgndb.openDgnDb(fileName, mode).then((res: BentleyReturn<DbResult, void>) => {
                if (res.error)
                    resolve({ error: res.error });
                else {
                    DgnDb.dbs.set(fileName, dgndb);
                    resolve({ result: new DgnDbToken(fileName) });        // for now, we just use the fileName as the "token" that identifies the Db
                }
            });
        });
    }

    @RunsIn(Tier.Services, { synchronous: true })
    public static callCloseDb(dbToken: DgnDbToken) {
        const dgndb = DgnDb.dbs.get(dbToken.id);
        if (undefined === dgndb) {
            return;
        }
        dgndb.closeDgnDb();
        DgnDb.dbs.delete(dbToken.id);
    }

    /**
     * Get a JSON representation of an element.
     * @param opt A JSON string with options for loading the element
     * @return Promise that resolves to an object with a result property set to the JSON string of the element.
     * The resolved object contains an error property if the operation failed.
     */
    @RunsIn(Tier.Services)
    public static callGetElement(dbToken: DgnDbToken, opt: string): BentleyPromise<DgnDbStatus, string> {
        const dgndb = DgnDb.dbs.get(dbToken.id);
        if (undefined === dgndb) {
            return DgnDb.getPromiseError(DgnDbStatus.NotOpen, "");
        }
        return dgndb.getElement(opt);
    }

    @RunsIn(Tier.Services)
    public static callGetElementPropertiesForDisplay(dbToken: DgnDbToken, eid: string): BentleyPromise<DbResult, string> {
        const dgndb = DgnDb.dbs.get(dbToken.id);
        if (undefined === dgndb) {
            return DgnDb.getNotOpenDbResultPromise();
        }
        return dgndb.getElementPropertiesForDisplay(eid);
    }
    /**
     * Insert a new element into the DgnDb.
     * @param props A JSON string with properties of new element
     * @return Promise that resolves to an object with
     * The resolved object contains an error property if the operation failed.
     */
    @RunsIn(Tier.Services)
    public static callInsertElement(dbToken: DgnDbToken, props: string): BentleyPromise<DgnDbStatus, string> {
        const dgndb = DgnDb.dbs.get(dbToken.id);
        if (undefined === dgndb) {
            return DgnDb.getPromiseError(DgnDbStatus.NotOpen, "");
        }
        return dgndb.insertElement(props);
    }

    /**
     * Get a JSON representation of a Model.
     * @param opt A JSON string with options for loading the model
     * @return Promise that resolves to an object with a result property set to the JSON string of the model.
     * The resolved object contains an error property if the operation failed.
     */
    @RunsIn(Tier.Services)
    public static callGetModel(dbToken: DgnDbToken, opt: string): BentleyPromise<DbResult, string> {
        const dgndb = DgnDb.dbs.get(dbToken.id);
        if (undefined === dgndb) {
            return DgnDb.getNotOpenDbResultPromise();
        }
        return dgndb.getModel(opt);
    }

    /**
     * Execute an ECSql select statement
     * @param ecsql The ECSql select statement to prepare
     * @return Promise that resolves to an object with a result property set to a JSON array containing the rows returned from the query
     * The resolved object contains an error property if the operation failed.
     */
    @RunsIn(Tier.Services)
    public static callExecuteQuery(dbToken: DgnDbToken, ecsql: string): BentleyPromise<DbResult, string> {
        const dgndb = DgnDb.dbs.get(dbToken.id);
        if (undefined === dgndb) {
            return DgnDb.getNotOpenDbResultPromise();
        }
        return dgndb.executeQuery(ecsql);
    }

    /**
     * Get the meta data for the specified ECClass from the schema in this iModel.
     * @param ecschemaname  The name of the schema
     * @param ecclassname   The name of the class
     * @return Promise that resolves to an object with a result property set to a the meta data in JSON format
     * The resolved object contains an error property if the operation failed.
     */
    @RunsIn(Tier.Services)
    public static callGetECClassMetaData(dbToken: DgnDbToken, ecschemaname: string, ecclassname: string): BentleyPromise<DgnDbStatus, string> {
        const dgndb = DgnDb.dbs.get(dbToken.id);
        if (undefined === dgndb) {
            return DgnDb.getPromiseError(DgnDbStatus.NotOpen, "");
        }
        return dgndb.getECClassMetaData(ecschemaname, ecclassname);
    }

    /**
     * Get the meta data for the specified ECClass from the schema in this iModel, blocking until the result is returned.
     * @param ecschemaname  The name of the schema
     * @param ecclassname   The name of the class
     * @return On success, the BentleyReturn result property will be the class meta data in JSON format.
     */
    @RunsIn(Tier.Services, { synchronous: true })
    public static callGetECClassMetaDataSync(dbToken: DgnDbToken, ecschemaname: string, ecclassname: string): BentleyReturn<DgnDbStatus, string> {
        const dgndb = DgnDb.dbs.get(dbToken.id);
        if (undefined === dgndb) {
            return DgnDb.getReturnError(DgnDbStatus.NotOpen, "");
        }
        return dgndb.getECClassMetaDataSync(ecschemaname, ecclassname);
    }
}
