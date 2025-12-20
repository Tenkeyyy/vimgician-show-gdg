import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { vim , Vim } from '@replit/codemirror-vim';
import React , {useState , useRef , useEffect} from 'react' ;
import { oneDark } from '@codemirror/theme-one-dark';
import styles from './Button.module.css';
import * as ts from 'typescript';
import { linter } from '@codemirror/lint';


function tsDiagnosticsToCmDiagnostics(tsDiagnostics) {
    return tsDiagnostics.map(d => {
      const from = d.start ?? 0;
      const to = from + (d.length ?? 1);

      return {
        from,
        to,
        severity: d.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
        message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      };
    });
  }
  
  function CodeEditor(){
    const [activeFile, setActiveFile] = useState('/file.ts');
    const viewRef = useRef(null);
    const versionRef = useRef(0);
    const activeFileRef = useRef(activeFile);
    const fileVersionsRef = useRef({});
    const selectionRef = useRef({});
    const [pendingDefPos, setPendingDefPos] = useState(null);
    const [useVim, setVim] = useState(false) ;
    const [code, setCode] = useState(`function hello(name){
      console.log("Hello " + name);
      }
      hello("World"); `);
    const DEFAULT_LIB_FILE = 'lib.d.ts';  
    const DEFAULT_LIB = `
      declare var console: {
        log: (...args: any[]) => void;
      };

      declare class RegExp {
        constructor(pattern: string | RegExp, flags?: string);
        exec(string: string): RegExpExecArray | null;
        test(string: string): boolean;
      }

      interface RegExpExecArray extends Array<string> {
        index: number;
        input: string;
      }

      interface IArguments {
        length: number;
        callee: Function;
        [index: number]: any;
      }

      interface Array<T> {
        length: number;
      }

      interface String {
        length: number;
      }

      interface Number {}
      interface Boolean {}
      interface Object {}
      interface Function {}
      `;
      const filesRef = useRef({ '/file.ts': code , '/lib.d.ts': DEFAULT_LIB, '/main.ts': `import { hello } from './utils'; hello();`, '/utils.ts': `export function hello() {}`, });
      const fileList = Object.keys(filesRef.current).filter(f => f !== 'lib.d.ts');
      const setActiveFileSafe = (file) => {
        activeFileRef.current = file;
        setActiveFile(file);
      };
      const goToDefinition = () => {
        const view = viewRef.current;
        if (!view || !tsServiceRef.current) return;
        const file = activeFileRef.current;
        const pos = view.state.selection.main.head;
        const defs = tsServiceRef.current.getDefinitionAtPosition(
          file,
          pos
        );
          if (!defs || defs.length === 0) return;

          const def = defs[0];

            if (def.fileName !== file) {
              setActiveFileSafe(def.fileName);
              setPendingDefPos(def.textSpan.start);
            } else {
                view.dispatch({
                  selection: { anchor: def.textSpan.start },
                  scrollIntoView: true,
                });
              }
            };

            useEffect(() => {
              for (const f of Object.keys(filesRef.current)) {
                fileVersionsRef.current[f] ??= 0;
              }
            }, []); 


    const updateVim = () => {
        setVim(!useVim);
    }
    const tsServiceRef = useRef(null);
    const tsLinter = linter(() => {
      if (!tsServiceRef.current) return [];

      const program = tsServiceRef.current.getProgram();
      if (!program) return [];

      const diagnostics = ts.getPreEmitDiagnostics(program);

      return tsDiagnosticsToCmDiagnostics(diagnostics);
    });
    useEffect(() => {
        Vim.defineAction('goToDefinition', () => {
        goToDefinition();
      });

      Vim.mapCommand(
        'gd',
        'action',
        'goToDefinition',
        {},
        { context: 'normal' }
      );
    const host = {
        getScriptFileNames: () => Object.keys(filesRef.current),
        getScriptVersion: (fileName) => String(fileVersionsRef.current[fileName] ?? 0),
        getScriptSnapshot: (fileName) => {
            const text = filesRef.current[fileName];
            return text ? ts.ScriptSnapshot.fromString(text) : undefined;
        },
        getCurrentDirectory: () => '/',
        getCompilationSettings: () => ({ allowJs: true, 
                                         checkJs: true, 
                                         target: ts.ScriptTarget.ESNext, 
                                         moduleResolution: ts.ModuleResolutionKind.NodeNext, 
                                         module: ts.ModuleKind.NodeNext, 
                                         allowImportingTsExtensions: true, 
                                         noEmit: true, }),
        getDefaultLibFileName: () => DEFAULT_LIB_FILE,
        fileExists: (fileName) =>  fileName in filesRef.current,
        readFile: (fileName) => filesRef.current[fileName],
      
    };
    tsServiceRef.current = ts.createLanguageService(host, ts.createDocumentRegistry());
  }, []);
    const handleChange = (value, viewUpdate) => {
    setCode(value);
    filesRef.current[activeFile] = value;
    fileVersionsRef.current[activeFile]++;
    versionRef.current++ ;

    const pos = viewUpdate.state.selection.main.head;
     selectionRef.current[activeFile] = pos;

    const program = tsServiceRef.current.getProgram();
    if (program) {
      const diagnostics = ts.getPreEmitDiagnostics(program);
    }
    const offset = value.length;
    const hover = tsServiceRef.current.getQuickInfoAtPosition(activeFile, offset);
    const defs = tsServiceRef.current.getDefinitionAtPosition(activeFile, offset);
};


    return (
  <div>
    <div style={{ marginBottom: '8px' }}>
      {fileList.map(file => (
          <button
            key={file}
            onClick={() => {
              setActiveFileSafe(file);
              fileVersionsRef.current[file]++;
            }}
            style={{
              marginRight: '6px',
              fontWeight: file === activeFile ? 'bold' : 'normal'
            }}
          >
            {file}
  </button>
        ))}
    </div>
    <button className={styles.button} onClick={updateVim}>
      Vim: {useVim ? 'ON' : 'OFF'}
    </button>
    <CodeMirror
      key={activeFile} 
      value={filesRef.current[activeFile]}
      height="300px"
      extensions={[
        javascript(),
        useVim && vim(),
        tsLinter,
      ].filter(Boolean)}
      theme={oneDark}
      onChange={handleChange}
      onCreateEditor={(view) => {
        viewRef.current = view;
        if (pendingDefPos !== null) {
          view.dispatch({
            selection: { anchor: pendingDefPos },
            scrollIntoView: true,
          });
          setPendingDefPos(null);
        }
  }}
    />
  </div>
);
}


export default CodeEditor;