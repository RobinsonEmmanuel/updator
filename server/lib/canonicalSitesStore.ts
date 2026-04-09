import { MongoClient, Db, ObjectId } from "mongodb"
import { decryptAppPassword } from "./credentialsCrypto"

interface CanonicalSiteDoc {
  _id: ObjectId | string
  name: string
  url: string
  regionIds?: string[]
  regionsUpdatedAt?: Date | null
}

interface CanonicalConnectionDoc {
  userId: string
  rl_user_id?: string
  siteId: string
  site_id?: string
  username: string
  appPasswordEncrypted?: string
  appPassword?: string
}

export interface CanonicalSite {
  _id: string
  name: string
  url: string
  regionIds: string[]
  regionsUpdatedAt: Date | null
}

export interface CanonicalCredentials {
  username: string
  appPassword: string
}

let canonicalClient: MongoClient | null = null
let canonicalDb: Db | null = null

async function getDb(): Promise<Db> {
  if (canonicalDb) return canonicalDb
  const uri = process.env.SERVICE_REDACTION_MONGODB_URI?.trim() || process.env.MONGODB_URI?.trim()
  if (!uri) {
    throw new Error("SERVICE_REDACTION_MONGODB_URI (or MONGODB_URI) is required")
  }
  canonicalClient = new MongoClient(uri)
  await canonicalClient.connect()
  canonicalDb = canonicalClient.db("service-redaction")
  return canonicalDb
}

function toSiteIdString(value: ObjectId | string): string {
  return typeof value === "string" ? value : value.toHexString()
}

function siteIdFilter(siteId: string): Record<string, unknown> {
  if (ObjectId.isValid(siteId)) {
    return { $or: [{ _id: new ObjectId(siteId) }, { _id: siteId }] }
  }
  return { _id: siteId }
}

function normalizeSite(doc: CanonicalSiteDoc): CanonicalSite {
  return {
    _id: toSiteIdString(doc._id),
    name: doc.name,
    url: doc.url,
    regionIds: doc.regionIds || [],
    regionsUpdatedAt: doc.regionsUpdatedAt || null,
  }
}

function parseStoredPassword(conn: CanonicalConnectionDoc): string {
  if (conn.appPasswordEncrypted) return decryptAppPassword(conn.appPasswordEncrypted)
  if (conn.appPassword) return decryptAppPassword(conn.appPassword)
  return ""
}

export async function listCanonicalSites(): Promise<CanonicalSite[]> {
  const db = await getDb()
  const docs = await db.collection<CanonicalSiteDoc>("sites").find({}).sort({ name: 1 }).toArray()
  return docs.map(normalizeSite)
}

export async function findCanonicalSiteById(siteId: string): Promise<CanonicalSite | null> {
  const db = await getDb()
  const doc = await db.collection<CanonicalSiteDoc>("sites").findOne(siteIdFilter(siteId))
  return doc ? normalizeSite(doc) : null
}

export async function updateCanonicalSiteRegions(siteId: string, regionIds: string[]): Promise<CanonicalSite | null> {
  const db = await getDb()
  const updated = await db
    .collection<CanonicalSiteDoc>("sites")
    .findOneAndUpdate(
      siteIdFilter(siteId),
      {
        $set: {
          regionIds,
          regionsUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    )
  return updated ? normalizeSite(updated) : null
}

export async function getCanonicalUserCredentials(
  userId: string | undefined,
  siteId: string
): Promise<CanonicalCredentials | null> {
  if (!userId) return null

  const db = await getDb()
  const connection = await db
    .collection<CanonicalConnectionDoc>("site_connections")
    .findOne({
      $or: [
        { userId, siteId },
        { rl_user_id: userId, site_id: siteId },
      ],
    })
  if (!connection) return null

  const appPassword = parseStoredPassword(connection)
  if (!connection.username || !appPassword) return null

  return { username: connection.username, appPassword }
}
