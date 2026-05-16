import { useState, useRef, useCallback, useEffect } from "react";
import { UploadCloud, FileText, Search, Filter, Download, Trash2, Folder, X, Eye, FolderOpen, File, AlertCircle, CheckCircle, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ReadOnlyBanner, LimitedAccessBanner } from "../components/RoleGuard";
import Pagination from "../components/Pagination";
import { getProperties, type PropertyDto } from "../services/propertyService";
import { deleteDocument, getApiErrorMessage, getDocuments, uploadDocument, type PropertyDocumentDto } from "../services/filingService";

type DocType    = "PDF" | "Excel" | "Image" | "Word";
type FolderName = "All Documents" | "Tax Declarations" | "Payment Receipts" | "Property Documents" | "Assessment Records" | "Legal Documents" | "Audit Files";

type DocFile = { dbId: number; id: string; propertyId: number; propertyPin: string; name: string; type: DocType; size: string; date: string; folder: FolderName; };

const INITIAL_DOCS: DocFile[] = [];

const FOLDERS: FolderName[] = [
  "All Documents", "Tax Declarations", "Payment Receipts", "Property Documents", "Assessment Records", "Legal Documents", "Audit Files"
];

const TYPE_CFG: Record<DocType, { color: string; bg: string }> = {
  PDF:   { color: "text-red-500",     bg: "bg-red-50"     },
  Excel: { color: "text-emerald-600", bg: "bg-emerald-50" },
  Image: { color: "text-purple-500",  bg: "bg-purple-50"  },
  Word:  { color: "text-blue-500",    bg: "bg-blue-50"    },
};

const getFileType = (n: string): DocType =>
  n.endsWith(".pdf") ? "PDF" :
  n.endsWith(".xlsx") || n.endsWith(".xls") ? "Excel" :
  n.endsWith(".docx") || n.endsWith(".doc") ? "Word" : "Image";

const parseSizeToMb = (size: string) => {
  const [value, unit] = size.split(" ");
  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    return 0;
  }

  return unit === "GB" ? parsedValue * 1024 : parsedValue;
};

const formatFileSize = (bytes: number) => {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
};

const normalizeFolder = (folder: string): FolderName => {
  return FOLDERS.includes(folder as FolderName) && folder !== "All Documents" ? folder as FolderName : "Property Documents";
};

function toDateInput(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().split("T")[0] : date.toISOString().split("T")[0];
}

function mapDocument(document: PropertyDocumentDto): DocFile {
  return {
    dbId: document.id,
    id: `DOC-${String(document.id).padStart(3, "0")}`,
    propertyId: document.propertyId,
    propertyPin: document.propertyPin ?? String(document.propertyId),
    name: document.originalFileName,
    type: getFileType(document.originalFileName.toLowerCase()),
    size: formatFileSize(document.sizeInBytes),
    date: toDateInput(document.uploadedAtUtc),
    folder: normalizeFolder(document.folder),
  };
}

export default function Filing() {
  const { can, user } = useAuth();

  const canUpload = can("filing.upload");
  const canDelete = can("filing.delete");
  const isAuditor = user?.role === "Auditor";
  const isStaff   = user?.role === "Staff";

  const [docs,         setDocs]         = useState<DocFile[]>(INITIAL_DOCS);
  const [properties,   setProperties]   = useState<PropertyDto[]>([]);
  const [propertyId,   setPropertyId]   = useState("");
  const [activeFolder, setActiveFolder] = useState<FolderName>("All Documents");
  const [search,       setSearch]       = useState("");
  const [dragOver,     setDragOver]     = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [toast,        setToast]        = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocFile | null>(null);
  const [previewDoc,   setPreviewDoc]   = useState<DocFile | null>(null);
  const [currentPage,  setCurrentPage]  = useState(1);
  const perPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    let ignore = false;

    async function loadFilingData() {
      setLoading(true);

      try {
        const [propertyResult, documentResult] = await Promise.all([getProperties(), getDocuments()]);

        if (!ignore) {
          setProperties(propertyResult);
          setPropertyId((current) => current || (propertyResult[0]?.id ? String(propertyResult[0].id) : ""));
          setDocs(documentResult.map(mapDocument));
        }
      } catch (error) {
        if (!ignore) {
          showToast(getApiErrorMessage(error), "error");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadFilingData();

    return () => {
      ignore = true;
    };
  }, []);

  const filteredDocs = docs.filter((d) => {
    const matchFolder = activeFolder === "All Documents" || d.folder === activeFolder;
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.folder.toLowerCase().includes(search.toLowerCase());
    return matchFolder && matchSearch;
  });

  const totalDocPages = Math.ceil(filteredDocs.length / perPage);
  const paginatedDocs = filteredDocs.slice((currentPage - 1) * perPage, currentPage * perPage);

  const folderCounts = FOLDERS.reduce((acc, f) => ({
    ...acc, [f]: f === "All Documents" ? docs.length : docs.filter(d => d.folder === f).length
  }), {} as Record<FolderName, number>);

  const storageLimitMb = 100 * 1024;
  const storageUsedMb = docs.reduce((sum, doc) => sum + parseSizeToMb(doc.size), 0);
  const storagePercent = Math.min((storageUsedMb / storageLimitMb) * 100, 100);
  const storageLabel = storageUsedMb >= 1024
    ? `${(storageUsedMb / 1024).toFixed(1)} GB`
    : `${storageUsedMb.toFixed(1)} MB`;

  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !canUpload) return;

    if (!propertyId) {
      showToast("Select a registered property before uploading files.", "error");
      return;
    }

    setUploading(true);

    try {
      const targetFolder = activeFolder === "All Documents" ? "Property Documents" : activeFolder;
      const uploadedFiles = await Promise.all(Array.from(files).map((file) => uploadDocument(Number(propertyId), targetFolder, file)));

      setDocs((previousDocs) => [...uploadedFiles.map(mapDocument), ...previousDocs]);
      showToast(`${uploadedFiles.length} file(s) uploaded successfully.`);
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [activeFolder, canUpload, propertyId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (canUpload) processFiles(e.dataTransfer.files);
  }, [processFiles, canUpload]);

  const handleDelete = async () => {
    if (!deleteTarget || !canDelete) return;

    setUploading(true);

    try {
      await deleteDocument(deleteTarget.dbId);
      setDocs((p) => p.filter((d) => d.dbId !== deleteTarget.dbId));
      showToast("Document deleted."); setDeleteTarget(null);
    } catch (error) {
      showToast(getApiErrorMessage(error), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${toast.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {toast.type === "success" ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-slate-900 tracking-tight">Filing & Documentation</h1>
          <p className="text-sm text-slate-500 mt-1">Secure repository for all property tax documents, receipts, and official records.</p>
        </div>
        {canUpload ? (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-64">
              <option value="">Select property for upload</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{property.pin} · {property.ownerName}</option>
              ))}
            </select>
            <button disabled={uploading || !propertyId} onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: "#0d2137" }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e3a5f"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#0d2137"}>
              <UploadCloud className="h-4 w-4" /> Upload Files
            </button>
          </div>
        ) : (
          <div className="px-4 py-2 bg-slate-100 text-slate-400 rounded-lg text-sm font-medium flex items-center gap-2 cursor-not-allowed border border-slate-200">
            <Lock className="h-4 w-4" /> Upload Files
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.docx,.jpg,.png" className="hidden"
          onChange={(e) => processFiles(e.target.files)} />
      </div>

      {/* Role banners */}
      {isAuditor && <ReadOnlyBanner message="Read-Only Mode — Auditors can browse and view documents but cannot upload or delete files." />}
      {isStaff   && <LimitedAccessBanner message="Staff Mode — You can upload documents. Deleting files requires Accountant or Admin access." />}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Folder Sidebar */}
        <div className="md:col-span-1 bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-xs text-slate-500 uppercase tracking-wider font-medium">Document Folders</h3>
          </div>
          <div className="p-3 space-y-0.5">
            {FOLDERS.map((folder) => {
              const isActive = activeFolder === folder;
              return (
                <button key={folder} onClick={() => { setActiveFolder(folder); setCurrentPage(1); }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? "text-white" : "text-slate-600 hover:bg-slate-50"}`}
                  style={isActive ? { backgroundColor: "#0d2137" } : {}}>
                  <div className="flex items-center gap-2.5">
                    {isActive ? <FolderOpen className="h-4 w-4 flex-shrink-0" /> : <Folder className="h-4 w-4 flex-shrink-0 text-slate-400" />}
                    <span className="text-sm text-left">{folder}</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {folderCounts[folder]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500 mb-2">Storage Used</p>
            <div className="w-full bg-slate-200 rounded-full h-2 mb-1.5">
              <div className="h-2 rounded-full" style={{ width: `${storagePercent}%`, backgroundColor: "#0d2137" }} />
            </div>
            <p className="text-xs text-slate-500">{storageLabel} of 100 GB</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-3 space-y-4">
          {/* Drop Zone */}
          {canUpload ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${dragOver ? "border-blue-500 bg-blue-50" : uploading ? "border-blue-300 bg-blue-50 cursor-not-allowed" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"}`}>
              <div className={`p-4 rounded-full mb-3 ${dragOver || uploading ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                <UploadCloud className={`h-7 w-7 ${uploading ? "animate-bounce" : ""}`} />
              </div>
              {uploading ? (
                <>
                  <h3 className="text-slate-700">Uploading files...</h3>
                  <div className="w-32 bg-slate-200 rounded-full h-1.5 mt-3">
                    <div className="h-1.5 rounded-full animate-pulse" style={{ width: "70%", backgroundColor: "#0d2137" }} />
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-slate-700">{dragOver ? "Drop files here" : "Drag & drop files here"}</h3>
                  <p className="text-sm text-slate-400 mt-1">PDF, Excel, Word, images up to 50 MB</p>
                  <button type="button" className="mt-4 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 shadow-sm">Browse Files</button>
                </>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50 cursor-not-allowed">
              <div className="p-4 rounded-full mb-3 bg-slate-100 text-slate-300">
                <Lock className="h-7 w-7" />
              </div>
              <h3 className="text-slate-400">File Upload Restricted</h3>
              <p className="text-sm text-slate-400 mt-1">Your role ({user?.role}) does not have upload permission.</p>
            </div>
          )}

          {/* Document Table */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <h3 className="text-slate-900">
                  {activeFolder} <span className="text-xs text-slate-400 font-normal ml-1">({filteredDocs.length} files)</span>
                </h3>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input type="text" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-44" />
                </div>
                <button className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50"><Filter className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-medium border-b border-slate-200 tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">File Name</th>
                    <th className="px-5 py-3.5">Folder</th>
                    <th className="px-5 py-3.5">Property</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Size</th>
                    <th className="px-5 py-3.5">Uploaded</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">Loading documents from database...</td></tr>
                  ) : filteredDocs.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">No documents found.</td></tr>
                  ) : (
                    paginatedDocs.map((doc) => {
                      const tc = TYPE_CFG[doc.type];
                      return (
                        <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`p-1.5 rounded-md flex-shrink-0 ${tc.bg}`}><File className={`h-4 w-4 ${tc.color}`} /></div>
                              <span className="font-medium text-slate-900 truncate max-w-[200px]" title={doc.name}>{doc.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                              <Folder className="h-3 w-3" /> {doc.folder}
                            </span>
                          </td>
                          <td className="px-5 py-3.5"><span className="font-mono text-xs text-blue-700 font-bold">{doc.propertyPin}</span></td>
                          <td className="px-5 py-3.5"><span className={`px-2 py-0.5 rounded text-xs font-bold ${tc.bg} ${tc.color}`}>{doc.type}</span></td>
                          <td className="px-5 py-3.5 text-xs text-slate-500">{doc.size}</td>
                          <td className="px-5 py-3.5 text-xs text-slate-500">{doc.date}</td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setPreviewDoc(doc)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Preview">
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Download">
                                <Download className="h-3.5 w-3.5" />
                              </button>
                              {canDelete ? (
                                <button disabled={uploading} onClick={() => setDeleteTarget(doc)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50" title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <div className="p-1.5 text-slate-200 cursor-not-allowed" title="Delete restricted">
                                  <Lock className="h-3.5 w-3.5" />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!canDelete && (
              <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-2 text-xs text-slate-500">
                <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                {isAuditor ? "Auditors have view-only access. Upload and delete require higher permission." : "Deleting documents requires Accountant or Admin access."}
              </div>
            )}
            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
              <span>Showing {filteredDocs.length === 0 ? 0 : Math.min((currentPage - 1) * perPage + 1, filteredDocs.length)}–{Math.min(currentPage * perPage, filteredDocs.length)} of {filteredDocs.length} file(s)</span>
              <Pagination currentPage={currentPage} totalPages={totalDocPages} onPageChange={setCurrentPage} />
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-slate-900">File Details</h3>
              <button onClick={() => setPreviewDoc(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-6">
              <div className={`w-16 h-16 rounded-2xl ${TYPE_CFG[previewDoc.type].bg} flex items-center justify-center mx-auto mb-4`}>
                <FileText className={`h-8 w-8 ${TYPE_CFG[previewDoc.type].color}`} />
              </div>
              <h3 className="text-center text-slate-900 mb-1 break-all text-sm">{previewDoc.name}</h3>
              <div className="mt-4 space-y-3">
                {[["Document ID",previewDoc.id],["Property",previewDoc.propertyPin],["File Type",previewDoc.type],["File Size",previewDoc.size],["Upload Date",previewDoc.date],["Folder",previewDoc.folder]].map(([l,v]) => (
                  <div key={l} className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-xs text-slate-500">{l}</span>
                    <span className="text-sm font-medium text-slate-800">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <button className="flex-1 py-2 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                  style={{ backgroundColor: "#0d2137" }}>
                  <Download className="h-4 w-4" /> Download
                </button>
                {canDelete && (
                  <button onClick={() => { setDeleteTarget(previewDoc); setPreviewDoc(null); }} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && canDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-slate-900 mb-2">Delete Document?</h3>
              <p className="text-sm font-medium text-slate-900 bg-slate-50 px-3 py-2 rounded-lg mb-3 break-all">{deleteTarget.name}</p>
              <p className="text-xs text-red-500">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button disabled={uploading} onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button disabled={uploading} onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">{uploading ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
