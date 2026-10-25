"""Launch a named Claude agent with active-context supervision and durable reports."""
import argparse, json, os, pathlib, subprocess, sys, threading, queue, time, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
RUNS = ROOT / 'docs/design-blue/runs'
BIN = pathlib.Path('C:/Users/georg/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-win32-x64/claude.exe')
RUNS.mkdir(parents=True, exist_ok=True)

def stream(args, cwd, name, capacity=None):
    proc = subprocess.Popen([str(BIN), *args], cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace', creationflags=subprocess.CREATE_NO_WINDOW)
    events = queue.Queue()
    def reader(pipe, channel):
        for line in pipe: events.put((channel, line))
        events.put((channel, None))
    for channel, pipe in [('out', proc.stdout), ('err', proc.stderr)]:
        threading.Thread(target=reader, args=(pipe,channel), daemon=True).start()
    ended=0; peak=0; result=None; stopped=False; last_ping=time.monotonic()
    with (RUNS/f'{name}.jsonl').open('w',encoding='utf-8') as log:
        while ended < 2:
            try: channel,line=events.get(timeout=5)
            except queue.Empty:
                if time.monotonic()-last_ping>=45:
                    print(f'{name}: running, peak active context {peak:,} tokens',flush=True);last_ping=time.monotonic()
                continue
            if line is None: ended+=1;continue
            if channel=='err':
                with (RUNS/f'{name}.stderr.log').open('a',encoding='utf-8') as f:f.write(line)
                continue
            log.write(line);log.flush()
            try: event=json.loads(line)
            except json.JSONDecodeError:continue
            kind=event.get('type')
            if kind=='system' and event.get('subtype')=='init':
                print(f'{name}: started {event.get("model")} agent session {event.get("session_id")}',flush=True)
            if kind=='assistant':
                message=event.get('message',{});u=message.get('usage',{})
                active=sum(u.get(k,0) or 0 for k in ['input_tokens','cache_read_input_tokens','cache_creation_input_tokens','output_tokens'])
                peak=max(peak,active)
                if capacity and active>=capacity*.8 and not stopped:
                    stopped=True;proc.terminate()
                    print(f'{name}: terminated at {100*active/capacity:.2f}% context; fresh session required',flush=True)
                for block in message.get('content',[]):
                    if block.get('type')=='tool_use':print(f'{name}: {block.get("name")}, context {active:,}'+(f' ({100*active/capacity:.2f}%)' if capacity else ''),flush=True)
            if kind=='result':result=event
            if kind=='system' and event.get('subtype')=='api_retry':
                print(f'{name}: API retry {event.get("attempt")}: {event.get("error_status")}',flush=True)
    proc.wait()
    if result:
        (RUNS/f'{name}-report.md').write_text(result.get('result',''),encoding='utf-8')
        (RUNS/f'{name}-summary.json').write_text(json.dumps({'exit_code':proc.returncode,'peak_active_tokens':peak,'capacity':capacity,'result':result},indent=2),encoding='utf-8')
    return result,stopped,proc.returncode

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--app',required=True);parser.add_argument('--role',required=True);parser.add_argument('--prompt',required=True);parser.add_argument('--name',required=True)
    opt=parser.parse_args();cwd=ROOT/'New'/opt.app
    definition=(cwd/'.claude/agents'/f'{opt.role}.md').read_text(encoding='utf-8')
    match=re.search(r'^model:\s*(\S+)\s*$',definition,re.MULTILINE)
    model=match.group(1) if match else 'sonnet'
    calibration_file=RUNS/f'{model}-capacity.json'
    if calibration_file.exists():capacity=json.loads(calibration_file.read_text())['capacity']
    else:
        r,_,code=stream(['-p','Reply READY only. Do not use tools.','--model',model,'--tools','','--output-format','stream-json','--verbose','--strict-mcp-config','--no-session-persistence'],cwd,f'{model}-calibration')
        if code or not r or r.get('is_error'):raise RuntimeError('Claude calibration failed; inspect log')
        capacities=[m['contextWindow'] for m in r.get('modelUsage',{}).values() if m.get('contextWindow')]
        if not capacities:raise RuntimeError('No context window telemetry; cannot guarantee 80% supervision')
        capacity=min(capacities);calibration_file.write_text(json.dumps({'capacity':capacity}),encoding='utf-8')
    prompt=pathlib.Path(opt.prompt).read_text(encoding='utf-8')
    args=['-p',prompt,'--agent',opt.role,'--model',model,'--output-format','stream-json','--verbose','--strict-mcp-config','--permission-mode','acceptEdits','--permission-prompts','none','--add-dir',str(ROOT/'docs/design-blue')]
    if opt.role in ['designer','code-reviewer','product-verifier','security-reviewer']:
        args+=['--add-dir',*[str(ROOT/'New'/a) for a in ['CompanyUI','AdminUI','ServiceUI']]]
        if opt.role != 'designer':
            args+=['--add-dir',*[str(ROOT/'ServiceTokenAPI/ServiceTokenAPI'/a) for a in ['Controllers','Dto','Enums']]]
        args+=['--allowedTools','Read,Glob,Grep,Bash(git status*),Bash(git diff*),Bash(git log*),Bash(node *)']
    else:
        args+=['--allowedTools','Read,Glob,Grep,Edit,Write,Bash(node *),Bash(npm run build*),Bash(npx ng build*),Bash(git status*),Bash(git diff*),Bash(git log*),Bash(python *)']
    for attempt in range(1,11):
        name=opt.name if attempt==1 else f'{opt.name}-restart-{attempt}'
        r,stopped,code=stream(args,cwd,name,capacity)
        if stopped:
            args[1]=prompt+'\nA previous session was terminated at 80% active context. This is a FRESH session. Read your on-disk docs/design-blue/CHECKPOINT.md, current diff and existing phase reports; continue remaining work without duplicating completed work.'
            continue
        if code or not r or r.get('is_error'):
            print(f'{name}: FAILED. See durable log/report.',flush=True);return 1
        denials=r.get('permission_denials',[])
        print(f'{name}: complete; peak context {100*max(0,json.loads((RUNS/f"{name}-summary.json").read_text())["peak_active_tokens"])/capacity:.2f}%; permission denials {len(denials)}',flush=True)
        return 0
    return 2
if __name__=='__main__':sys.exit(main())
