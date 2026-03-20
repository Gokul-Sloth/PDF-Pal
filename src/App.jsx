import { useState, useRef, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { _GSPS2PDF } from "./lib/worker-init.js";
import RightButtonBar from './components/RightButtonBar.jsx';

// PDF Settings presets
const PDF_SETTINGS = {
  '/screen': 'Smallest',
  '/ebook': 'Small',
  '/printer': 'Medium',
  '/prepress': 'High'
};

function loadPDFData(response, filename) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", response);
    xhr.responseType = "arraybuffer";
    xhr.onload = function () {
      window.URL.revokeObjectURL(response);
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = new Blob([xhr.response], { type: "application/pdf" });
        const pdfURL = window.URL.createObjectURL(blob);
        const size = xhr.response.byteLength;
        resolve({ pdfURL, size });
      } else {
        reject(new Error(`Failed to load PDF data: ${xhr.statusText}`));
      }
    };
    xhr.onerror = function () {
      window.URL.revokeObjectURL(response);
      reject(new Error("Network error while loading PDF data"));
    };
    xhr.send();
  });
}

function App() {
  const [activeTab, setActiveTab] = useState("compress");
  const [state, setState] = useState("init");
  const [files, setFiles] = useState([]);
  const [downloadLinks, setDownloadLinks] = useState([]);
  const [pdfSetting, setPdfSetting] = useState("/ebook");
  const [customCommand, setCustomCommand] = useState("");
  const [useCustomCommand, setUseCustomCommand] = useState(false);
  const [splitRange, setSplitRange] = useState({ startPage: "", endPage: "" });
  const [maxPages, setMaxPages] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [showTerminalOutput, setShowTerminalOutput] = useState(false);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const [terminalData, setTerminalData] = useState("");
  const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0, currentPage: 0 });
  const terminalRef = useRef(null);

  // Simplified advanced PDF settings
  const [advancedSettings, setAdvancedSettings] = useState({
    compatibilityLevel: "1.4",
    colorImageSettings: {
      downsample: true,
      resolution: 300
    }
  });
  const [useAdvancedSettings, setUseAdvancedSettings] = useState(false);

  // Auto-scroll terminal output to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalData]);

  // Function to extract progress information from terminal output
  const parseProgressFromOutput = (output) => {
    // Extract total pages from "Processing pages X through Y"
    const totalPagesMatch = output.match(/Processing pages \d+ through (\d+)/);
    if (totalPagesMatch) {
      const totalPages = parseInt(totalPagesMatch[1]);
      setProgressInfo(prev => ({ ...prev, total: totalPages }));
    }

    // Extract current page from "Page X" 
    const currentPageMatch = output.match(/^Page (\d+)$/);
    if (currentPageMatch) {
      const currentPage = parseInt(currentPageMatch[1]);
      setProgressInfo(prev => ({
        ...prev,
        currentPage: currentPage,
        current: currentPage // Update current to match the page being processed
      }));
    }
  };

  async function processPDF(operation, inputFiles, filename) {
    setState("loading");
    setTerminalData(""); // Clear previous terminal data
    setProgressInfo({ current: 0, total: 0, currentPage: 0 }); // Reset progress

    try {
      let dataObject = {
        operation,
        pdfSetting: useCustomCommand ? null : (operation === 'compress' ? pdfSetting : '/default'),
        customCommand: useCustomCommand ? customCommand : null,
        advancedSettings: useAdvancedSettings ? advancedSettings : null,
        showTerminalOutput: showTerminalOutput, // Pass terminal output setting to worker
        showProgressBar: showProgressBar // Pass progress bar setting to worker
      };

      if (operation === 'merge') {
        dataObject.files = inputFiles.map(file => file.url);
      } else if (operation === 'split') {
        dataObject.psDataURL = inputFiles[0].url;
        dataObject.splitRange = {
          startPage: parseInt(splitRange.startPage, 10),
          endPage: parseInt(splitRange.endPage, 10)
        };
      } else {
        // compress
        dataObject.psDataURL = inputFiles[0].url;
      }

      const result = await _GSPS2PDF(
        dataObject,
        null, // responseCallback (not used in promise version)
        (showTerminalOutput || showProgressBar) ? (outputText) => {
          // Update terminal output if enabled
          if (showTerminalOutput) {
            setTerminalData(prev => prev + outputText + '\n');
          }
          // Parse progress information if progress bar is enabled
          if (showProgressBar) {
            parseProgressFromOutput(outputText);
          }
        } : null // outputCallback
      );

      // Check for errors in the result
      if (result.error) {
        console.error("Processing failed:", result.error);
        setState("error");
        setErrorMessage(result.error);
        setTerminalData(""); // Clear terminal output on error
        setProgressInfo({ current: 0, total: 0, currentPage: 0 }); // Reset progress on error
        return;
      }

      const { pdfURL, size: newSize } = await loadPDFData(result.pdfDataURL, filename);

      setDownloadLinks([{
        url: pdfURL,
        filename: getOutputFilename(filename, operation),
        operation
      }]);
      setState("toBeDownloaded");
      setTerminalData(""); // Clear terminal output when done
      setProgressInfo({ current: 0, total: 0, currentPage: 0 }); // Reset progress when done

    } catch (error) {
      console.error("Processing failed:", error);
      setState("error");
      setErrorMessage(error.message || "An unexpected error occurred during processing");
      setTerminalData(""); // Clear terminal output on error
      setProgressInfo({ current: 0, total: 0, currentPage: 0 }); // Reset progress on error
    }
  }

  function getOutputFilename(originalName, operation) {
    const baseName = originalName.replace('.pdf', '');
    switch (operation) {
      case 'compress':
        return `${baseName}-compressed.pdf`;
      case 'merge':
        return `merged-${Date.now()}.pdf`;
      case 'split':
        return `${baseName}-split-${splitRange.startPage}-${splitRange.endPage}.pdf`;
      default:
        return `${baseName}-processed.pdf`;
    }
  }

  const changeHandler = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length === 0) return;

    const fileObjects = selectedFiles.map(file => ({
      filename: file.name,
      url: window.URL.createObjectURL(file),
      file: file
    }));

    // For compress and split operations, replace existing files (single file only)
    // For merge, allow multiple files
    if (activeTab === 'merge') {
      setFiles(prevFiles => [...prevFiles, ...fileObjects]);
    } else {
      // Clean up previous files for compress/split
      files.forEach(file => {
        window.URL.revokeObjectURL(file.url);
      });
      // Prevent memory leak if user selects multiple files in non-merge tabs
      fileObjects.slice(1).forEach(file => {
        window.URL.revokeObjectURL(file.url);
      });

      const primaryFile = fileObjects[0];
      setFiles([primaryFile]);

      // Calculate max pages for the selected file using pdf-lib
      try {
        const arrayBuffer = await primaryFile.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        setMaxPages(pdfDoc.getPageCount());
      } catch (err) {
        console.error("Failed to parse PDF pages:", err);
        setMaxPages(0);
      }
    }
    setState("selected");

    // Reset the input value so selecting the same file again triggers onChange
    event.target.value = null;
  };

  const removeFile = (indexToRemove) => {
    setFiles(prevFiles => {
      const newFiles = prevFiles.filter((_, index) => index !== indexToRemove);
      // Clean up blob URL
      window.URL.revokeObjectURL(prevFiles[indexToRemove].url);
      return newFiles;
    });

    // Update state if no files left
    if (files.length === 1) {
      setState("init");
    }
  };

  const clearAllFiles = () => {
    // Clean up blob URLs
    files.forEach(file => {
      window.URL.revokeObjectURL(file.url);
    });
    setFiles([]);
    setMaxPages(0);
    setState("init");
  };

  const addMoreFiles = () => {
    document.getElementById('files').click();
  };

  const onSubmit = (event) => {
    event.preventDefault();
    if (files.length === 0) return;

    // Validation
    if (activeTab === 'merge' && files.length < 2) {
      alert('Please select at least 2 PDF files to merge.');
      return;
    }

    if (activeTab === 'split' && (!splitRange.startPage || !splitRange.endPage)) {
      alert('Please specify page range for splitting.');
      return;
    }

    if (activeTab === 'split') {
      const startPage = parseInt(splitRange.startPage, 10);
      const endPage = parseInt(splitRange.endPage, 10);
      if (isNaN(startPage) || isNaN(endPage) || startPage < 1 || endPage < startPage) {
        alert('Please enter valid page numbers. End page must be greater than or equal to start page.');
        return;
      }
      if (maxPages > 0 && (startPage > maxPages || endPage > maxPages)) {
        alert(`Page numbers cannot exceed the total number of pages in the PDF (${maxPages}).`);
        return;
      }
    }

    if (useCustomCommand && !customCommand.trim()) {
      alert('Please enter a custom command or disable custom command mode.');
      return;
    }

    if (useCustomCommand) {
      const cmd = customCommand.trim();
      if (!cmd.includes('-sDEVICE=') || !cmd.includes('-sOutputFile=')) {
        alert('Custom command must include -sDEVICE= and -sOutputFile= parameters.');
        return;
      }
    }

    const primaryFilename = files[0]?.filename || 'output.pdf';
    processPDF(activeTab, files, primaryFilename);
  };

  const resetForm = () => {
    // Clean up blob URLs
    files.forEach(file => {
      window.URL.revokeObjectURL(file.url);
    });
    downloadLinks.forEach(link => {
      window.URL.revokeObjectURL(link.url);
    });

    setFiles([]);
    setDownloadLinks([]);
    setState("init");
    setSplitRange({ startPage: "", endPage: "" });
    setMaxPages(0);
    setErrorMessage("");
    setTerminalData(""); // Clear terminal output
    setProgressInfo({ current: 0, total: 0, currentPage: 0 }); // Reset progress
    setUseAdvancedSettings(false);
    setAdvancedSettings({
      compatibilityLevel: "1.4",
      colorImageSettings: {
        downsample: true,
        resolution: 300
      }
    });
  };

  const processAgain = () => {
    // Keep the files but reset to selected state
    downloadLinks.forEach(link => {
      window.URL.revokeObjectURL(link.url);
    });
    setDownloadLinks([]);
    setState("selected");
    setErrorMessage("");
    setTerminalData(""); // Clear terminal output
    setProgressInfo({ current: 0, total: 0, currentPage: 0 }); // Reset progress
  };

  const renderFileInput = () => {
    const accept = "application/pdf";
    const multiple = activeTab === 'merge';

    return (
      <div className="space-y-6">
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          name="files"
          onChange={changeHandler}
          id="files"
          className="hidden"
        />
        {files.length === 0 && (
          <div className="text-center">
            <label
              htmlFor="files"
              className="btn-primary cursor-pointer text-lg px-8 py-4 rounded-xl"
            >
              Choose PDF file{multiple ? "s" : ""} to {activeTab}
            </label>
          </div>
        )}


      </div>
    );
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-muted-50 to-muted-100 dark:from-gray-900 dark:to-gray-800">
      {/* Responsive Navbar Header */}
      <header className="w-full bg-white dark:bg-gray-900 shadow-soft border-b border-muted-200 dark:border-gray-800">
        <nav className="container mx-auto max-w-4xl px-4 py-4 flex flex-row items-center justify-between">
          {/* Left: Page Title */}
          <div className="flex items-center h-full">
            <img
              src="/local-pdf-tools/pdf-file.svg"
              alt="PDF Icon"
              className="w-8 h-8 md:w-10 md:h-10 mr-3"
              style={{ display: 'inline-block', verticalAlign: 'middle' }}
            />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white whitespace-nowrap inline-block align-middle">
              Local PDF Tools
            </h1>
          </div>
          {/* Right: Buttons */}
          <div className="flex items-center h-full">
            <RightButtonBar />
            {/* Add more right-side buttons here if needed */}
          </div>
        </nav>
      </header>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Info below navbar */}
        <div className="text-center mb-12">
          <p className="text-lg text-muted-600 dark:text-muted-300 max-w-2xl mx-auto">
            Compress, merge, and split PDF files locally in your browser using no uploads required - everything stays on your device.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-muted-100 dark:bg-gray-800 p-1 rounded-2xl shadow-soft border border-muted-200 dark:border-gray-700">
            <button
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${activeTab === 'compress'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-soft'
                : 'text-muted-600 dark:text-muted-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              onClick={() => {
                if (activeTab !== 'compress') {
                  setActiveTab('compress');
                  resetForm();
                }
              }}
            >
              Compress
            </button>
            <button
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${activeTab === 'merge'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-soft'
                : 'text-muted-600 dark:text-muted-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              onClick={() => {
                if (activeTab !== 'merge') {
                  setActiveTab('merge');
                  resetForm();
                }
              }}
            >
              Merge
            </button>
            <button
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${activeTab === 'split'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-soft'
                : 'text-muted-600 dark:text-muted-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              onClick={() => {
                if (activeTab !== 'split') {
                  setActiveTab('split');
                  resetForm();
                }
              }}
            >
              Split
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="card mb-8">
          {activeTab === 'compress' && (
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Compress PDF</h3>
              <p className="text-muted-600 dark:text-muted-300">Reduce PDF file size while maintaining quality.</p>
            </div>
          )}
          {activeTab === 'merge' && (
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Merge PDFs</h3>
              <p className="text-muted-600 dark:text-muted-300">Combine multiple PDF files into a single document.</p>
            </div>
          )}
          {activeTab === 'split' && (
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Split PDF</h3>
              <p className="text-muted-600 dark:text-muted-300">Extract specific page ranges from a PDF document.</p>
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-6 pt-6 border-t border-muted-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
                <span className="text-lg font-bold text-muted-600 dark:text-muted-400">
                  {files.length} file{files.length > 1 ? 's' : ''} selected
                </span>
                <button
                  type="button"
                  className="btn-danger text-sm px-4 py-2 rounded-xl"
                  onClick={clearAllFiles}
                  title="Clear all files"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-3">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-muted-50 dark:bg-gray-700 border border-muted-200 dark:border-gray-600 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {file.filename}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ml-4 p-2 text-muted-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      onClick={() => removeFile(index)}
                      title="Remove file"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}

                {activeTab === 'merge' && (
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-300 dark:border-gray-600 rounded-xl text-muted-600 dark:text-muted-400 hover:border-muted-400 dark:hover:border-gray-500 hover:text-muted-700 dark:hover:text-muted-300 transition-colors"
                    onClick={addMoreFiles}
                  >
                    <span className="text-xl font-bold">+</span>
                    Add more files
                  </button>
                )}

                {activeTab === 'compress' && (
                  <div className="pt-4 mt-2 border-t border-muted-200 dark:border-gray-700">
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-900 dark:text-white">
                        PDF Quality Setting:
                      </label>
                      <select
                        value={pdfSetting}
                        onChange={(e) => setPdfSetting(e.target.value)}
                        className="input"
                      >
                        {Object.entries(PDF_SETTINGS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {activeTab === 'split' && (
                  <div className="pt-4 mt-2 border-t border-muted-200 dark:border-gray-700">
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-900 dark:text-white flex justify-between items-center">
                        <span>Page Range:</span>
                        {maxPages > 0 && (
                          <span className="text-xs text-muted-500 dark:text-muted-400 bg-muted-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                            Max Pages: {maxPages}
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          placeholder="Start page"
                          value={splitRange.startPage}
                          onChange={(e) => setSplitRange(prev => ({ ...prev, startPage: e.target.value }))}
                          min="1"
                          max={maxPages > 0 ? maxPages : undefined}
                          className="input flex-1"
                        />
                        <span className="text-muted-600 dark:text-muted-400 font-medium">to</span>
                        <input
                          type="number"
                          placeholder="End page"
                          value={splitRange.endPage}
                          onChange={(e) => setSplitRange(prev => ({ ...prev, endPage: e.target.value }))}
                          min="1"
                          max={maxPages > 0 ? maxPages : undefined}
                          className="input flex-1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {state !== "loading" && state !== "toBeDownloaded" && state !== "error" && (
          <form onSubmit={onSubmit} className="space-y-8">
            {renderFileInput()}
            {state === "selected" && (
              <div className="text-center">
                <button
                  type="submit"
                  className="btn-primary text-lg px-8 py-4 rounded-xl"
                >
                  {`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} PDF${activeTab === 'merge' ? 's' : ''}`}
                </button>
              </div>
            )}
          </form>
        )}

        {state === "loading" && (
          <div className="card text-center space-y-4">
            <div className="text-2xl mb-4 animate-spin-slow">⏳</div>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              Processing your PDF{activeTab === 'merge' ? 's' : ''}...
            </p>

            {/* Progress Bar */}
            {showProgressBar && (progressInfo.total > 0 || progressInfo.currentPage > 0) && (
              <div className="bg-muted-50 dark:bg-gray-700 border border-muted-200 dark:border-gray-600 rounded-xl p-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Processing Progress
                  </h4>
                  <span className="text-sm text-muted-600 dark:text-muted-400">
                    {progressInfo.total > 0
                      ? `Page ${progressInfo.currentPage} of ${progressInfo.total}`
                      : `Page ${progressInfo.currentPage}`
                    }
                  </span>
                </div>
                {progressInfo.total > 0 ? (
                  <>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 mb-2">
                      <div
                        className="bg-primary-600 h-3 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${(progressInfo.current / progressInfo.total) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-600 dark:text-muted-400">
                      <span>{Math.round((progressInfo.current / progressInfo.total) * 100)}% Complete</span>
                      <span>{progressInfo.current}/{progressInfo.total} pages</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center py-2">
                    <div className="animate-pulse text-sm text-muted-600 dark:text-muted-400">
                      Processing page {progressInfo.currentPage}...
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Terminal Output Display */}
            {showTerminalOutput && (
              <div className="bg-muted-50 dark:bg-gray-700 border border-muted-200 dark:border-gray-600 rounded-xl p-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Terminal Output
                  </h4>
                  <span className="text-xs text-muted-600 dark:text-muted-400">
                    Live Output
                  </span>
                </div>
                <div ref={terminalRef} className="bg-black dark:bg-gray-900 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words">
                    {terminalData || 'Initializing...'}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
            <div className="text-red-600 dark:text-red-400 mb-4">
              <p className="text-lg font-semibold mb-2">An error occurred while processing your PDF:</p>
              <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-xl p-4 text-left">
                <pre className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-words font-mono">
                  {errorMessage}
                </pre>
              </div>
            </div>
            <button onClick={resetForm} className="btn-danger">
              Try Again
            </button>
          </div>
        )}

        {state === "toBeDownloaded" && (
          <div className="card text-center py-12 px-4 shadow-xl border border-green-100 dark:border-green-900/30 bg-gradient-to-b from-white to-green-50/50 dark:from-gray-800 dark:to-gray-800/80 animate-fade-up">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-6 shadow-sm">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Done! Your PDF is ready
            </h3>
            <p className="text-muted-600 dark:text-muted-300 mb-8 max-w-md mx-auto">
              Your file has been successfully processed. Click the button below to download it securely to your device.
            </p>

            <div className="flex flex-col items-center justify-center mb-10 space-y-4">
              {downloadLinks.map((link, i) => (
                <a key={i} href={link.url} download={link.filename}
                  className="flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-1">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download {link.filename}</span>
                </a>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 border-t border-muted-200 dark:border-gray-700 pt-8">
              <button
                onClick={processAgain}
                className="w-full sm:w-auto px-6 py-3 font-medium text-gray-700 dark:text-gray-300 bg-muted-100 dark:bg-gray-700 hover:bg-muted-200 dark:hover:bg-gray-600 rounded-xl transition-colors duration-200"
              >
                Edit Input
              </button>
              <button
                onClick={resetForm}
                className="w-full sm:w-auto px-6 py-3 font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors duration-200 shadow-sm"
              >
                New Input
              </button>
            </div>
          </div>
        )}

        {/* Info & Features Section */}
        <div className="card mt-12">
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Features</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Show Terminal Output Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="showTerminalOutput"
                  checked={showTerminalOutput}
                  onChange={(e) => setShowTerminalOutput(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                />
                <label htmlFor="showTerminalOutput" className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                  Show terminal output
                </label>
              </div>

              {/* Show Progress Bar Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="showProgressBar"
                  checked={showProgressBar}
                  onChange={(e) => setShowProgressBar(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                />
                <label htmlFor="showProgressBar" className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                  Show progress bar
                </label>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="useAdvancedSettings"
                  checked={useAdvancedSettings}
                  onChange={(e) => setUseAdvancedSettings(e.target.checked)}
                  disabled={useCustomCommand}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2 disabled:opacity-50"
                />
                <label htmlFor="useAdvancedSettings" className={`text-sm font-medium text-gray-900 dark:text-white cursor-pointer ${useCustomCommand ? 'opacity-50' : ''}`}>
                  Use advanced settings
                </label>
              </div>

              {/* Custom Command Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="useCustomCommand"
                  checked={useCustomCommand}
                  onChange={(e) => setUseCustomCommand(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                />
                <label htmlFor="useCustomCommand" className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                  Use custom Ghostscript command
                </label>
              </div>
            </div>
          </div>

          {/* Conditional Sub-panels */}
          {(useCustomCommand || useAdvancedSettings) && (
            <div className="mb-8 border-t border-muted-200 dark:border-gray-700 pt-6">
              <div className="space-y-6">
                {useCustomCommand ? (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-900 dark:text-white">
                      Custom Command:
                    </label>
                    <input
                      type="text"
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                      placeholder="e.g., -sDEVICE=pdfwrite -dPDFSETTINGS=/screen -dNOPAUSE -dQUIET -dBATCH -sOutputFile=output.pdf input.pdf"
                      className="input font-mono text-sm"
                    />
                    <p className="text-xs text-muted-600 dark:text-muted-400">
                      Enter full Ghostscript command arguments. Required: -sDEVICE= and -sOutputFile=
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Advanced Settings Panel */}
                    {useAdvancedSettings && (
                      <div className="bg-muted-50 dark:bg-gray-700 border border-muted-200 dark:border-gray-600 rounded-xl p-6 space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-muted-200 dark:border-gray-600 pb-3">
                          Advanced PDF Settings
                        </h4>

                        <div className="space-y-6">
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-muted-200 dark:border-gray-600">
                            <h5 className="text-base font-medium text-gray-900 dark:text-white mb-4 border-b border-muted-200 dark:border-gray-600 pb-2">
                              Essential Settings
                            </h5>

                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <label className="text-sm font-medium text-gray-900 dark:text-white">
                                  PDF Compatibility Level:
                                </label>
                                <select
                                  value={advancedSettings.compatibilityLevel}
                                  onChange={(e) => setAdvancedSettings(prev => ({
                                    ...prev,
                                    compatibilityLevel: e.target.value
                                  }))}
                                  className="input sm:w-48"
                                >
                                  <option value="1.3">PDF 1.3 (Acrobat 4)</option>
                                  <option value="1.4">PDF 1.4 (Acrobat 5)</option>
                                  <option value="1.5">PDF 1.5 (Acrobat 6)</option>
                                  <option value="1.6">PDF 1.6 (Acrobat 7)</option>
                                  <option value="1.7">PDF 1.7 (Acrobat 8)</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  id="downsampleImages"
                                  checked={advancedSettings.colorImageSettings.downsample}
                                  onChange={(e) => setAdvancedSettings(prev => ({
                                    ...prev,
                                    colorImageSettings: {
                                      ...prev.colorImageSettings,
                                      downsample: e.target.checked
                                    }
                                  }))}
                                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 focus:ring-2"
                                />
                                <label htmlFor="downsampleImages" className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                                  Downsample color images
                                </label>
                              </div>

                              {advancedSettings.colorImageSettings.downsample && (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                                    Color Image Resolution (DPI):
                                  </label>
                                  <input
                                    type="number"
                                    value={advancedSettings.colorImageSettings.resolution}
                                    onChange={(e) => setAdvancedSettings(prev => ({
                                      ...prev,
                                      colorImageSettings: {
                                        ...prev.colorImageSettings,
                                        resolution: parseInt(e.target.value) || 300
                                      }
                                    }))}
                                    min="72"
                                    max="1200"
                                    className="input sm:w-32"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-muted-200 dark:border-gray-700 pt-6">
            <p className="text-muted-600 dark:text-muted-300 mb-0">
              <strong className="text-gray-900 dark:text-white">Privacy & Security:</strong><br />
              All processing happens locally in your browser. No files are uploaded to any server.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-muted-200 dark:border-gray-700 pt-6">
          <div className="flex justify-between items-center">
            <p className="text-muted-600 dark:text-muted-300">
              &copy; {new Date().getFullYear()} Code licensed under AGPLv3.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
