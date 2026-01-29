from dotenv import load_dotenv

from langgraph.prebuilt import create_react_agent

load_dotenv()
from langchain_groq import ChatGroq
from .prompts import *
from .states import *
from .tools import *
from langgraph.constants import END
from langgraph.graph  import StateGraph
from langchain_core.globals import set_debug, set_verbose
set_debug(True)
set_verbose(True)
llm  = ChatGroq(model="openai/gpt-oss-120b",temperature=0)

import datetime, re, uuid, pathlib
from agents import tools

BASE_OUTPUT_DIR = pathlib.Path.cwd() / "generated_projects"

def create_project_root(user_prompt: str) -> pathlib.Path:
    BASE_OUTPUT_DIR.mkdir(exist_ok=True)

    slug = re.sub(r"[^a-z0-9]+", "_", user_prompt.lower())[:40]
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    uid = uuid.uuid4().hex[:6]

    root = BASE_OUTPUT_DIR / f"{slug}_{ts}_{uid}"
    root.mkdir(parents=True)

    return root

def planner_agent(state : dict) -> dict:
    user_prompt = state["user_prompt"]
    project_root = create_project_root(user_prompt)
    tools.PROJECT_ROOT = project_root
    resp = llm.with_structured_output(Plan).invoke(planner_prompt(user_prompt))
    return {"plan": resp, "project_root": str(project_root)}

def architect_agent(state : dict) -> dict:
    plan = state["plan"]
    resp = llm.with_structured_output(TaskPlan).invoke(architect_prompt(plan))
    if resp is None:
        raise ValueError("Invalid response from architect agent")
    resp.plan = plan
    return {"task_plan": resp}

def coder_agent(state : dict) -> dict:
    coder_state = state.get("coder_state")
    if coder_state is None:
        coder_state = CoderState(task_plan=state["task_plan"],current_step_idx=0)
    steps = coder_state.task_plan.implementation_steps

    if coder_state.current_step_idx >= len(steps):
        return {"coder_state":coder_state, "status":"DONE"}

    current_task = steps[coder_state.current_step_idx]
    existing_content = read_file.run(current_task.filepath)


    user_prompt = (
        f"Task: {current_task.task_description}\n"
        f"File: {current_task.filepath}\n"
        f"Existing content:\n{existing_content}\n"
        "Use write_file(path, content) to save your changes."
    )
    system_prompt = coder_system_prompt()

    coder_tools = [read_file,write_file,list_files,get_current_directory]
    react_agent =  create_react_agent(llm,coder_tools)
    react_agent.invoke({"messages": [{"role": "system", "content": system_prompt},
                                     {"role": "user", "content": user_prompt}]})
    coder_state.current_step_idx += 1
    return {
        "coder_state": coder_state,
        "status": "IN_PROGRESS"
    }



graph = StateGraph(dict)
graph.add_node("planner", planner_agent)
graph.add_node("architect", architect_agent)
graph.add_node("coder",coder_agent)
graph.add_edge("planner", "architect")
graph.add_edge("architect", "coder")
graph.add_conditional_edges(
    "coder",
    lambda s: "END" if s.get("status") == "DONE" else "coder",
    {"END": END, "coder": "coder"}
)


graph.set_entry_point("planner")

agent = graph.compile()

if __name__ == "__main__":
    result = agent.invoke({"user_prompt": "Build a colourful modern todo app in html css and js"},
                          {"recursion_limit": 100})
    print(result)