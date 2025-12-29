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
      const [activeFile, setActiveFile] = useState('/file.ts');
      const viewRef = useRef(null);
      const versionRef = useRef(0);
      const activeFileRef = useRef(activeFile);
      const fileVersionsRef = useRef({});
      const selectionRef = useRef({});
      const [pendingDefPos, setPendingDefPos] = useState(null);
      const [useVim, setVim] = useState(false) ;
      const filesRef = useRef({ '/file.ts': code , '/lib.d.ts': DEFAULT_LIB, '/main.ts': `import { hello } from './utils'; hello();`, '/utils.ts': `export function hello() {}`, });
      const fileList = Object.keys(filesRef.current).filter(f => f !== '/lib.d.ts');
      const jumpStackRef = useRef([]);
      const jumpIndexRef = useRef(-1);
      const hasSavedCurrentRef = useRef(false);
      const pendingJumpRef = useRef(null);
      const setActiveFileSafe = (file) => {
        activeFileRef.current = file;
        setActiveFile(file);
      };
      const jumpBack = () => {
        const view = viewRef.current;
        if (!view) return;
        
        if (!hasSavedCurrentRef.current) {
          jumpStackRef.current.push({
            file: activeFileRef.current,
            pos: view.state.selection.main.head,
          });
          jumpIndexRef.current = jumpStackRef.current.length - 1;
          hasSavedCurrentRef.current = true;
            }
            
        if (jumpIndexRef.current < 0) return ;
        jumpIndexRef.current--;
        const jump =      jumpStackRef.current[jumpIndexRef.current];
        navigateTo(jump.file, jump.pos, false);
      }
      const jumpForward = () => {
        if (jumpIndexRef.current >= jumpStackRef.current.length - 1 ) return ;

        jumpIndexRef.current++;
        const jump = jumpStackRef.current[jumpIndexRef.current];
        navigateTo(jump.file, jump.pos , false);
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
          navigateTo(def.fileName, def.textSpan.start, true );
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
      Vim.defineAction('goToDefinition', goToDefinition);
      Vim.defineAction('jumpBack' , jumpBack);
      Vim.defineAction('jumpForward' , jumpForward);

      Vim.mapCommand(
        'gd',
        'action',
        'goToDefinition',
        {},
        { context: 'normal' },
      );

      Vim.mapCommand(
        '<C-o>',
        'action',
        'jumpBack',
        {},
        { context : 'normal'},
      );

      Vim.mapCommand(
        '<C-i>',
        'action',
        'jumpForward',
        {},
        { context : 'normal' }
      );

      Vim.mapCommand(
        '<C-l>',
        'action',
        'jumpForward',
        {},
        { context : 'normal' }
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
};


    function navigateTo(targetFile, targetPos, push = true) {
      const view = viewRef.current;
      const fromFile = activeFileRef.current;
      const fromPos =
      selectionRef.current[fromFile] ??
      view?.state.selection.main.head ??
      0;

      if (push) {
        jumpStackRef.current = jumpStackRef.current.slice(
          0,
          jumpIndexRef.current + 1
        );
        jumpStackRef.current.push({ file: fromFile, pos: fromPos });
        jumpIndexRef.current = jumpStackRef.current.length - 1 ;
        hasSavedCurrentRef.current = false;
      }

      if (targetFile !== fromFile) {
        pendingJumpRef.current = {file : targetFile , pos : targetPos};
        setActiveFileSafe(targetFile);
      } else if (view) {
        const safePos = Math.min(targetPos, view.state.doc.length)
        view.dispatch({
          selection: { anchor: safePos },
          scrollIntoView: true,
        });
      }
    }


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
      height="200px"
      extensions={[
        javascript(),
        useVim && vim(),
        tsLinter,
      ].filter(Boolean)}
      theme={oneDark}
      onChange={handleChange}
      
      onCreateEditor={(view) => {
        viewRef.current = view;
        const jump = pendingJumpRef.current;
        if (jump && jump.file === activeFile){
            const safePos = Math.min(jump.pos, view.state.doc.length);

            view.dispatch({
              selection: { anchor: safePos },
              scrollIntoView: true,
            });

            view.focus();
            pendingJumpRef.current = null;
          };
        view.focus();
      }}
    />
  </div>
);
}


export default CodeEditor;