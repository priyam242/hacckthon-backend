defmodule HackathonApi.Router do
  use Plug.Router

  plug CorsPlug, origin: ["*"]
  plug :match
  plug Plug.Parsers, parsers: [:json], pass: ["application/json"], json_decoder: Jason
  plug :dispatch

  get "/health" do
    payload = %{
      status: "healthy",
      framework: "Elixir Plug/Phoenix",
      service: "hackathon-elixir-phoenix",
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(payload))
  end

  get "/" do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(%{message: "Elixir Hackathon API is online!"}))
  end

  post "/api/ai/generate" do
    prompt = conn.body_params["prompt"] || "sample prompt"
    res = %{
      prompt: prompt,
      response: "[Elixir BEAM AI Engine] Concurrency process handled prompt: #{prompt}",
      model: "elixir-phoenix-engine"
    }
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(200, Jason.encode!(res))
  end

  match _ do
    problem = %{
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "Endpoint not found"
    }
    conn
    |> put_resp_content_type("application/problem+json")
    |> send_resp(404, Jason.encode!(problem))
  end
end
