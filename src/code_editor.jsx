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
    const viewRef = useRef(null);
    const versionRef = useRef(0);
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


        const goToDefinition = () => {
          const view = viewRef.current;
          if (!view || !tsServiceRef.current) return;

          const pos = view.state.selection.main.head;

          const defs = tsServiceRef.current.getDefinitionAtPosition(
            'file.ts',
            pos
          );

          if (!defs || defs.length === 0) return;

          const def = defs[0];

          view.dispatch({
            selection: { anchor: def.textSpan.start },
            scrollIntoView: true,
          });
        };


    const updateVim = () => {
        setVim(!useVim);
    }
    const filesRef = useRef({ 'file.ts': code , 'lib.d.ts': DEFAULT_LIB, });
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
        getScriptFileNames: () => [
        'lib.d.ts',
        'file.ts',
        ],
        getScriptVersion: () => versionRef.current.toString(),
        getScriptSnapshot: (fileName) => {
            const text = filesRef.current[fileName];
            return text ? ts.ScriptSnapshot.fromString(text) : undefined;
        },
        getCurrentDirectory: () => '/',
        getCompilationSettings: () => ({ allowJs: true, checkJs: true, target: ts.ScriptTarget.ESNext, }),
        getDefaultLibFileName: () => DEFAULT_LIB_FILE,
        fileExists: (fileName) =>  fileName in filesRef.current,
        readFile: (fileName) => filesRef.current[fileName],
      
    };
    tsServiceRef.current = ts.createLanguageService(host, ts.createDocumentRegistry());
  }, []);
    const handleChange = (value, viewUpdate) => {
    setCode(value);
    filesRef.current['file.ts'] = value;
    versionRef.current++ ;

    const program = tsServiceRef.current.getProgram();
    if (program) {
      const diagnostics = ts.getPreEmitDiagnostics(program);
      console.log('Diagnostics:', diagnostics.map(d => d.messageText.toString()));
    }
    const offset = value.length;
    const hover = tsServiceRef.current.getQuickInfoAtPosition('file.ts', offset);
    if (hover) console.log('Hover:', ts.displayPartsToString(hover.displayParts));
    const defs = tsServiceRef.current.getDefinitionAtPosition('file.ts', offset);
    if (defs) console.log('Definitions:', defs);
};


    return (
    <div>
          <button className={styles.button} onClick={updateVim}>
            setVim: {useVim ? 'ON' : 'OFF'}
            </button>
      <CodeMirror
        value={code}
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
        }}
      />
    </div>
)
}


export default CodeEditor;