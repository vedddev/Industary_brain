from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_anthropic import ChatAnthropic


def get_answer(question, docs, provider, api_key):

    provider = provider.lower()

    if provider == "groq":
        llm = ChatGroq(
            groq_api_key=api_key,
            model_name="llama-3.1-8b-instant",
            temperature=0
        )

    elif provider == "gemini":
        llm = ChatGoogleGenerativeAI(
            google_api_key=api_key,
            model="gemini-2.0-flash",
            temperature=0
        )

    elif provider == "openai":
        llm = ChatOpenAI(
            api_key=api_key,
            model="gpt-4.1-mini",
            temperature=0
        )

    elif provider == "anthropic":
        llm = ChatAnthropic(
            api_key=api_key,
            model="claude-3-5-sonnet-latest",
            temperature=0
        )

    else:
        raise ValueError("Unsupported AI provider.")

    context = "\n\n".join(doc.page_content for doc in docs)

    prompt = f"""
You are an expert AI tutor and Industrial Knowledge Assistant.

Your job is to answer the user's question using ONLY the information provided in the context.

Instructions:
- Understand the context instead of copying it.
- Explain the concept in simple, natural English.
- Organize the answer with headings and bullet points when appropriate.
- If examples exist in the context, include them.
- If the context does not contain enough information, say:
  "The uploaded documents do not contain enough information to answer this question."
- Never invent information outside the provided context.

Context:
{context}

Question:
{question}

Answer:
"""

    response = llm.invoke(prompt)

    return response.content