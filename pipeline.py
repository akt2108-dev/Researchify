from typing import Callable

from agents import build_reader_agent , build_search_agent , writer_chain , critic_chain

def run_research_pipeline(topic : str) -> dict:

    state = {}

    #search agent working 
    print("\n"+" ="*50)
    print("step 1 - search agent is working ...")
    print("="*50)

    search_agent = build_search_agent()
    search_result = search_agent.invoke({
        "messages" : [("user", f"Find recent, reliable and detailed information about: {topic}")]
    })
    state["search_results"] = search_result['messages'][-1].content

    print("\n search result ",state['search_results'])

    #step 2 - reader agent 
    print("\n"+" ="*50)
    print("step 2 - Reader agent is scraping top resources ...")
    print("="*50)

    reader_agent = build_reader_agent()
    reader_result = reader_agent.invoke({
        "messages": [("user",
            f"Based on the following search results about '{topic}', "
            f"pick the most relevant URL and scrape it for deeper content.\n\n"
            f"Search Results:\n{state['search_results'][:800]}"
        )]
    })

    state['scraped_content'] = reader_result['messages'][-1].content

    print("\nscraped content: \n", state['scraped_content'])

    #step 3 - writer chain 

    print("\n"+" ="*50)
    print("step 3 - Writer is drafting the report ...")
    print("="*50)

    research_combined = (
        f"SEARCH RESULTS : \n {state['search_results']} \n\n"
        f"DETAILED SCRAPED CONTENT : \n {state['scraped_content']}"
    )

    state["report"] = writer_chain.invoke({
        "topic" : topic,
        "research" : research_combined
    })

    print("\n Final Report\n",state['report'])

    #critic report 

    print("\n"+" ="*50)
    print("step 4 - critic is reviewing the report ")
    print("="*50)

    state["feedback"] = critic_chain.invoke({
        "report":state['report']
    })

    print("\n critic report \n", state['feedback'])

    return state


def run_research_pipeline_streaming(topic: str, emit: Callable[[dict], None]) -> dict:
    """
    Streaming version of run_research_pipeline().

    Calls emit(event_dict) at each stage transition while preserving the same
    synchronous LangChain execution model used by the CLI function.
    """
    state = {}

    steps = {
        1: {"label": "Search Agent", "icon": "search"},
        2: {"label": "Reader Agent", "icon": "globe"},
        3: {"label": "Writer", "icon": "edit"},
        4: {"label": "Critic", "icon": "check-circle"},
    }

    def step_start(step: int) -> None:
        emit({
            "event": "step_start",
            "step": step,
            "label": steps[step]["label"],
            "icon": steps[step]["icon"],
        })

    def step_output(step: int, content: str) -> None:
        emit({"event": "step_output", "step": step, "content": content})

    def step_done(step: int) -> None:
        emit({"event": "step_done", "step": step})

    try:
        step_start(1)
        search_agent = build_search_agent()
        search_result = search_agent.invoke({
            "messages": [("user", f"Find recent, reliable and detailed information about: {topic}")]
        })
        state["search_results"] = search_result["messages"][-1].content
        step_output(1, state["search_results"])
        step_done(1)
    except Exception as e:
        emit({"event": "error", "step": 1, "message": str(e)})
        raise

    try:
        step_start(2)
        reader_agent = build_reader_agent()
        reader_result = reader_agent.invoke({
            "messages": [("user",
                f"Based on the following search results about '{topic}', "
                f"pick the most relevant URL and scrape it for deeper content.\n\n"
                f"Search Results:\n{state['search_results'][:800]}"
            )]
        })
        state["scraped_content"] = reader_result["messages"][-1].content
        step_output(2, state["scraped_content"])
        step_done(2)
    except Exception as e:
        emit({"event": "error", "step": 2, "message": str(e)})
        raise

    try:
        step_start(3)
        research_combined = (
            f"SEARCH RESULTS : \n {state['search_results']} \n\n"
            f"DETAILED SCRAPED CONTENT : \n {state['scraped_content']}"
        )
        state["report"] = writer_chain.invoke({
            "topic": topic,
            "research": research_combined,
        })
        step_output(3, state["report"])
        step_done(3)
    except Exception as e:
        emit({"event": "error", "step": 3, "message": str(e)})
        raise

    try:
        step_start(4)
        state["feedback"] = critic_chain.invoke({
            "report": state["report"],
        })
        step_output(4, state["feedback"])
        step_done(4)
    except Exception as e:
        emit({"event": "error", "step": 4, "message": str(e)})
        raise

    emit({
        "event": "pipeline_complete",
        "report": state["report"],
        "feedback": state["feedback"],
    })

    return state



if __name__ == "__main__":
    topic = input("\n Enter a research topic : ")
    run_research_pipeline(topic)
