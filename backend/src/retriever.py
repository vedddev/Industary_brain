from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma

PERSIST_DIR = "./vectorstore"
COLLECTION_NAME = "industrial_docs"


def get_embeddings():
    return GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001"
    )


def create_vectorstore(chunks):

    embeddings = get_embeddings()

    vectordb = Chroma(
        persist_directory=PERSIST_DIR,
        embedding_function=embeddings,
        collection_name=COLLECTION_NAME
    )

    # Remove previous documents from the collection
    try:
        vectordb.delete_collection()
    except Exception:
        pass

    # Recreate the collection and add new documents
    vectordb = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=PERSIST_DIR,
        collection_name=COLLECTION_NAME
    )

    return vectordb


def get_retriever():

    embeddings = get_embeddings()

    vectordb = Chroma(
        persist_directory=PERSIST_DIR,
        embedding_function=embeddings,
        collection_name=COLLECTION_NAME
    )

    return vectordb.as_retriever(
        search_kwargs={"k": 5}
    )